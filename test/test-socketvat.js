var ME = module.exports = {}
var sv = require('../socketvat')
var ev = require('eventvat')
var nss = require('nssocket')
var net = require('net')
var EE2 = require('eventemitter2').EventEmitter2
var fs = require('fs')
var path = require('path')
var assert = require('assert')
var debug = require('debug')('test')
var common =
{ ee2log: function(name){return function(){
    debug((name || '☼')+':',this.event,'→',[].slice.call(arguments))
  }}
, vat: ev()
, timeTrigger: function(){
    common.timeTriggered = ~~(Date.now()/1000)
    return common.timeTriggered
  }
, plan: function plan(todo,cb) {
    if (!(this instanceof plan)) return new plan(todo,cb)
    var self = this
    self.todo = todo
    self.did = function(e) {if (--self.todo==0) cb && cb(e)}
  }
}
// console.log(Object.keys(ev.prototype))
// ;[ 'die', 'del', 'exists', 'expire', 'expireat', 'keys', 'move', 'object'
//  , 'persist', 'randomkey', 'rename', 'renamenx', 'sort', 'type', 'ttl'
//  , 'append', 'decr', 'decrby', 'get', 'getbit', 'getrange', 'getset', 'incr'
//  , 'incrby', 'mget', 'mset', 'msetnx', 'set', 'setbit', 'setex', 'setnx'
//  , 'setrange', 'strlen', 'hdel', 'hexists', 'hget', 'hgetall', 'hincr'
//  , 'hincrby', 'hdecr', 'hdecrby', 'hkeys', 'hlen', 'hmget' , 'hmset', 'hset'
//  , 'hsetnx', 'hvals', 'lindex', 'linsert', 'llen', 'lpop', 'lpush', 'lpushx'
//  , 'lrange', 'lrem', 'lset', 'ltrim', 'rpop', 'rpoplpush', 'rpush', 'rpushx'
//  , 'dump', 'swap', 'findin' ]
var remoteSamples =
[ { name:'del'       , methods:[['set','foo','bar']
                               ,['del','foo']]               , events:[['del','foo']]                    }
// die - does not emit events
, { name:'exists'    , methods:[['set','foo','bar']
                               ,['exists','foo']
                               ,['exists','bar']]            , events:[['exists foo',true]
                                                                      ,['exists bar',false]]             }
, { name:'expire'    , methods:[['set','foo','bar']
                               ,['expire','foo',100]]        , events:[['expire','foo',100]]             }
, { name:'expireat'  , methods:[['set','foo','bar']
                               ,['expireat','foo'
                                ,common.timeTrigger()+100]]  , events:[['expireat','foo'
                                                                       ,common.timeTriggered+100]]       }
, { name:'keys'      , methods:[['set','foo','bar']
                               ,['set','one',1]
                               ,['set','two',2]
                               ,['keys',/one|two/]
                               ,['keys','one|two']]          , events:[['keys','one|two',['one','two']]
                                                                      ,['keys','one|two',['one','two']]] }
// not sure about move..
// , { name:'move'      , methods:[['foo','bar']
//                                ,['move','foo',common.vat]] , events:[['move','foo',common.vat]
//                                                                     ,['move foo',common.vat]]      }
// object - not implemented yet
, { name:'persist'   , methods:[['set','foo','bar',100]
                               ,['persist','foo']]           , events:[['persist','foo']
                                                                      ,['persist foo']]                  }
, { name:'randomkey' , methods:[['set','a',1]
                               ,['set','b',2]
                               ,['set','c',3]
                               ,['randomkey']]               , eventsOr:[['randomkey','a']
                                                                        ,['randomkey','b']
                                                                        ,['randomkey','c']]              }
, { name:'rename'    , methods:[['set','a',1]
                               ,['rename','a','b']]          , events:[['rename','a','b']
                                                                      ,['rename a','b']]                 }
// renamenx
// sort - not implemented yet
// type - does not emit events
, { name:'ttl'       , methods:[['set','foo','bar']
                               ,['expire','foo',60]
                               ,['ttl','foo']]               , events:[['ttl','foo',60]
                                                                      ,['ttl foo',60]]                   }
, { name:'append'    , methods:[['set','foo','foo']
                               ,['append','foo','bar']]      , events:[['append','foo','bar',6]]  }
, { name:'decr(by)'  , methods:[['set','foo',3]
                               ,['decr','foo']]              , events:[['decr','foo',2]
                                                                      ,['decr foo',2]
                                                                      ,['decrby','foo',1,2]
                                                                      ,['decrby foo',1,2]]               }
// decrby
, { name:'get'       , methods:[['set','foo','bar']
                               ,['get','foo']]               , events:[['get','foo','bar']]              }
// getbit - not implemented yet
, { name:'getrange'  , methods:[['set','foo','hello world!']
                               ,['getrange','foo',6,11]]     , events:[['getrange','foo',6,11,'world']]  }
// getset - does not emit events
, { name:'incr(by)'  , methods:[['set','foo',3]
                               ,['incr','foo']]              , events:[['incr','foo',4]
                                                                      ,['incr foo',4]
                                                                      ,['incrby','foo',1,4]
                                                                      ,['incrby foo',1,4]]               }
// incrby
, { name:'mget'      , methods:[['set','foo','hello world!']
                               ,['set','bar',42]
                               ,['mget','foo','bar']]        , events:[['mget','foo','bar',['hello world!',42]]]     }
// mset
// msetnx
, { name:'set'       , methods:[['set','foo','bar']]         , events:[['set','foo','bar']]              }
// setbit - not implemented yet
// setex - not implemented yet
// setnx
// setrange
// strlen
, { name:'hdel'      , methods:[['hset','hash','a',1]
                               ,['hdel','hash','a']]         , events:[['hdel','hash','a']
                                                                      ,['hdel hash','a']]                }
// hexists
// hget
// hgetall
, { name:'hincr'     , methods:[['hset','foo','a',2]
                               ,['hincr','foo','a']]         , events:[['hincr','foo','a',3]
                                                                      ,['hincrby','foo','a',1,3]
                                                                      ,['hincr foo','a',3]
                                                                      ,['hincrby foo','a',1,3]]          }
// hincrby
// hdecr
// hdecrby
, { name:'hkeys'     , methods:[['hset','foo','a',1]
                               ,['hset','foo','b',2]
                               ,['hset','foo','c',3]
                               ,['hkeys','foo']]             , events:[['hkeys','foo',['a','b','c']]
                                                                      ,['hkeys foo',['a','b','c']]]      }
, { name:'hlen'      , methods:[['hset','foo','a',1]
                               ,['hset','foo','b',2]
                               ,['hset','foo','c',3]
                               ,['hlen','foo']]              , events:[['hlen','foo',3]
                                                                      ,['hlen foo',3]]                   }
// hmget
// hmset
, { name:'hset'      , methods:[['hset','hash','a',1]]       , events:[['hset','hash','a',1,false]
                                                                      ,['hset hash','a',1,false]]              }
// hsetnx
, { name:'hvals'     , methods:[['hset','foo','a',1]
                               ,['hset','foo','b',2]
                               ,['hset','foo','c',3]
                               ,['hvals','foo']]             , events:[['hvals','foo',[1,2,3]]
                                                                      ,['hvals foo',[1,2,3]]]            }
, { name:'lindex'    , methods:[['rpush','mylist','foo']
                               ,['lindex','mylist',0]]       , events:[['lindex','mylist',0,'foo']
                                                                      ,['lindex mylist',0,'foo']]        }
// linsert
, { name:'llen'      , methods:[['rpush','mylista','one']
                               ,['rpush','mylista','thow']
                               ,['rpush','mylista','three']
                               ,['llen','mylista']]          , events:[['llen','mylista',3]
                                                                      ,['llen mylista',3]]               }
// lpop
// lpush
// lpushx
// lrange
// lrem
, { name:'lset'      , methods:[['rpush','mylist','foo']
                               ,['lset','mylist',0,'one']]   , events:[['lset','mylist',0,'one']
                                                                      ,['lset mylist',0,'one']]          }
// ltrim
// rpop
// rpoplpush
// rpush
, { name:'rpushx'    , methods:[['rpush','mylist','one']
                               ,['rpushx','mylist','two']
                               ,['rpushx','myotherlist'
                                ,'three']]                   , events:[['rpushx','mylist','two',2]
                                                                      ,['rpushx mylist','two',2]]        }
// dump
, { name:'swap'      , methods:[['set','a',1]
                               ,['set','b',2]
                               ,['swap','a','b']]            , events:[['swap','a','b']
                                                                      ,['swap a','b']]                   }
, { name:'findin'    , methods:[['set','foo','hello']
                               ,['findin','foo','ll']]       , events:[['findin','foo','ll',2]
                                                                      ,['findin foo','ll',2]]            }
]

ME.remote = {}
ME.remote.before = function(done){
  var p = common.plan(2,done)
  var port = ~~(Math.random()*50000)+10000
  common.serverVat = sv()
  common.serverVat.onAny(common.ee2log('serverVat'))
  common.serverRemotes = []
  common.serverVat.listen(port,function(r,s){
    r.onAny(common.ee2log('serverRemote'))
    s.onAny(common.ee2log('serverSocket'))
    common.serverRemotes.push({remote:r,socket:s})
    p.did()
  })
  common.clientVat = sv()
  common.clientVat.onAny(common.ee2log('clientVat'))
  common.clientRemotes = []
  common.clientVat.connect(port,function(r,s){
    r.onAny(common.ee2log('clientRemote'))
    s.onAny(common.ee2log('clientSocket'))
    common.clientRemotes.push({remote:r,socket:s})
    p.did()
  })
}
ME.remote.beforeEach = function(done){
  for (var k in common.serverVat.hash) delete common.serverVat.hash[k]
  for (var k in common.clientVat.hash) delete common.clientVat.hash[k]
  common.serverVat.die()
  common.clientVat.die()
  done()
}

remoteSamples.forEach(function(x){
  ME.remote[x.name] = function(done){
    var p = common.plan(0,done)
    if (x.methods) {
      x.methods.forEach(function(m){
        var currM = m.shift()
        process.nextTick(function(){
          common.serverRemotes[0].remote[currM].apply(common.serverRemotes[0].remote,m)
          common.clientRemotes[0].remote[currM].apply(common.clientRemotes[0].remote,m)
        })
      })
    }
    if (x.events) {
      x.events.forEach(function(e){
        p.todo = p.todo+4
        var currE = e.shift()
        common.clientRemotes[0].remote.once(currE,function(){
          var args = [].slice.call(arguments)
          if (args[args.length-1] === null) args.pop() // eventvat.swap()
          assert.deepEqual(args,e)
          p.did()
        })
        common.serverRemotes[0].remote.once(currE,function(){
          var args = [].slice.call(arguments)
          if (args[args.length-1] === null) args.pop() // eventvat.swap()
          assert.deepEqual(args,e)
          p.did()
        })
        common.clientVat.once(currE,function(){
          var args = [].slice.call(arguments)
          if (args[args.length-1] === undefined) args.pop() // eventvat.swap()
          if (currE == 'keys') args[0] = args[0].source
          assert.deepEqual(args,e)
          p.did()
        })
        common.serverVat.once(currE,function(){
          var args = [].slice.call(arguments)
          if (args[args.length-1] === undefined) args.pop() // eventvat.swap()
          if (currE == 'keys') args[0] = args[0].source
          assert.deepEqual(args,e)
          p.did()
        })
      })
    }
    if (x.eventsOr) {
      p.todo = p.todo+4
      var ee = []
      x.eventsOr.forEach(function(e){
        var currE = e.shift()
        ee.push(currE)
        common.clientRemotes[0].remote.once(currE,function(){
          assert.ok(!~([].slice.call(arguments).indexOf(ee)))
          p.did()
        })
        common.serverRemotes[0].remote.once(currE,function(){
          assert.ok(!~([].slice.call(arguments).indexOf(ee)))
          p.did()
        })
        common.clientVat.once(currE,function(){
          assert.ok(!~([].slice.call(arguments).indexOf(ee)))
          p.did()
        })
        common.serverVat.once(currE,function(){
          assert.ok(!~([].slice.call(arguments).indexOf(ee)))
          p.did()
        })
      })
    }
  }
})

ME['simple set/get'] = function(done){
  var p = common.plan(10,done)
  var port = ~~(Math.random()*50000)+10000
  var serverVat = sv()
  serverVat.listen(port,function(r){
    r.on('*',function(){
      var args = [].slice.call(arguments)
      assert.deepEqual(args,['server','x'])
      var event = this.event.split(' ')
      if (event[0] == 'set') p.did()
      if (event[0] == 'get') p.did()
    })
    r.set('server','x')
    r.get('server')
  })

  var clientVat = sv()
  clientVat.connect(port,function(r){
    r.on('*',function(){
      var args = [].slice.call(arguments)
      assert.deepEqual(args,['client','y'])
      var event = this.event.split(' ')
      if (event[0] == 'set') p.did()
      if (event[0] == 'get') p.did()
    })
    r.set('client','y')
    r.get('client')
  })

  serverVat.on('*',function(){
    if (this.event == 'set' && arguments[0] == 'foo'    && arguments[1] == 'bar') p.did()
    if (this.event == 'set' && arguments[0] == 'client' && arguments[1] == 'y')   p.did()
    if (this.event == 'get' && arguments[0] == 'client' && arguments[1] == 'y')   p.did()
  })
  clientVat.on('*',function(){
    if (this.event == 'set' && arguments[0] == 'foo'    && arguments[1] == 'bar') p.did()
    if (this.event == 'set' && arguments[0] == 'server' && arguments[1] == 'x')   p.did()
    if (this.event == 'get' && arguments[0] == 'server' && arguments[1] == 'x')   p.did()
  })

  serverVat.set('foo','bar')
  clientVat.set('foo','bar')
}

ME['subscribe/unsubscribe'] = function(done){
  var p = common.plan(10,done)
  var port = ~~(Math.random()*50000)+10000
  var serverVat = sv()
  var foo = 111
  serverVat.set('foo',foo)
  var server = serverVat.listen(port)
  var clientVat = sv()
  clientVat.connect(port,function(r){
    r.on('get foo',function(i){
      r.off('get foo')
      assert.equal(i,foo)
      server.close()
      done()
    })
    r.get('foo')
  })
}

ME.tls = function(done) {
  var p = common.plan(10,done)
  var port = ~~(Math.random()*50000)+10000
  var fixturesPath = path.resolve(__dirname+'/../node_modules/nssocket/test/fixtures')
  var opts = { port : port
             , key  : fs.readFileSync(fixturesPath+'/ryans-key.pem')
             , cert : fs.readFileSync(fixturesPath+'/ryans-cert.pem')
             , ca   : fs.readFileSync(fixturesPath+'/ryans-csr.pem')
             }

  var foo = 111
  var serverVat = sv()
  serverVat.set('foo',foo)
  var server = serverVat.listen(opts)
  var clientVat = sv()
  clientVat.connect(opts,function(r){
    r.on('get foo',function(i){
      r.off('get foo')
      assert.equal(i,foo)
      server.close()
      done()
    })
    r.get('foo')
  })
}

ME.reconnect = function(done) {
  this.timeout(20000)
  var p = common.plan(10,done)
  var port = ~~(Math.random()*50000)+10000
  var serverVat = sv()
  var clientVat = sv()
  var client = clientVat.connect({port:port,reconnect:100})
  clientVat.once('reconnecting',function(){
    var server = serverVat.listen(port,function(r,s){
      debug('client connected')
      s.destroy()
      server.close() // why doesnt close also destroy the socket?
      var server2 = serverVat.listen(port,function(r,s){
        debug('client connected again')
        done()
      })
    })
  })
}

ME['multiple sockets'] = function(done) {
  var port = ~~(Math.random()*50000)+10000
  var unixsocket = __dirname+'/server.socket'
  var serverVat = sv()
  var client1Vat = sv()
  var client2Vat = sv()
  serverVat.listen(port)
  serverVat.listen(unixsocket)
  serverVat.onAny(common.ee2log('servervat'))
  var client1 = client1Vat.connect(unixsocket,function(r1,s1){
    var client2 = client2Vat.connect(port,function(r2,s2){
      r2.on('set',function(k,v){
        assert.equal('foo',k)
        assert.equal('bar',v)
        fs.unlink(unixsocket,done)
      })
      setTimeout(function(){
        r1.set('foo','bar')
      },200)
    })
  })
}

ME['connect/listen options parsing'] = function(done) {
  var port = ~~(Math.random()*50000)+10000
  var host = '0.0.0.0'
  var unixpath = __dirname+'/server.socket'

  var fixturesPath = path.resolve(__dirname+'/../node_modules/nssocket/test/fixtures')
  var key  = fs.readFileSync(fixturesPath+'/ryans-key.pem')
  var cert = fs.readFileSync(fixturesPath+'/ryans-cert.pem')
  var ca   = fs.readFileSync(fixturesPath+'/ryans-csr.pem')

  var opts = [ {server:[port]        , client:[port++]}
             , {server:[port,host]   , client:[port++,host]}
             , {server:[{port:port}] , client:[{port:port++}]}
             , {server:[unixpath]    , client:[unixpath]}
             , {server:[port,{key:key,cert:cert}] , client:[port,{key:key,cert:cert}]}
             ]

  var p = common.plan(0,preDone)
  opts.forEach(function(x,i){
    p.todo = p.todo+2
    x.server.push(function(){p.did()})
    x.client.push(function(){p.did()})
    var serverVat = sv()
    var server = sv.prototype.listen.apply(serverVat, x.server)
    var clientVat = sv()
    var client = sv.prototype.connect.apply(clientVat, x.client)
  })

  function preDone() {
    fs.unlink(unixpath)
    done()
  }
}

