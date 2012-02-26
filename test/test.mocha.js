var ME = module.exports = {}
var sv = require('../socketvat')
var EE2 = require('eventemitter2').EventEmitter2
var fs = require('fs')
var path = require('path')
var assert = require('assert')
var common =
{ ee2log: function(name){return function(){
    console.log((name || '☼')+':',this.event,'→',[].slice.call(arguments))
  }}
, plan: function plan(todo,cb) {
    if (!(this instanceof plan)) return new plan(todo,cb)
    var self = this
    self.todo = todo
    self.did = function(e) {if (--self.todo==0) cb && cb(e)}
  }
}
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
                               ,['del','foo']]             , events:[['del','foo']]            }
// die                                                     
, { name:'exists'    , methods:[['set','foo','bar']        
                               ,['exists','foo']           
                               ,['exists','bar']]          , events:[['exists foo',true]
                                                                    ,['exists bar',false]]     }
, { name:'expire'    , methods:[['set','foo','bar']                                            
                               ,['expire','foo',100]]      , events:[['expire','foo',100]]     }
// expireat                                                                                    
, { name:'keys'      , methods:[['set','foo','bar']                                            
                               ,['keys','.*']]             , events:[['keys',['foo'],/.*/]]    }
// move                                                                                        
// object                                                                                      
, { name:'randomkey' , methods:[['set','a',1]                                                  
                               ,['set','b',2]                                                  
                               ,['set','c',3]                                                  
                               ,['randomkey']]             , eventsOr:[['randomkey','a']       
                                                                      ,['randomkey','b']       
                                                                      ,['randomkey','c']]      }
, { name:'rename'    , methods:[['set','a',1]                                                  
                               ,['rename','a','b']]        , events:[['rename','a','b']        
                                                                    ,['rename a','b']]         }   
, { name:'hdel'      , methods:[['hset','hash','a',1]                                          
                               ,['hdel','hash','a']]       , events:[['hdel','hash','a']       
                                                                    ,['hdel hash','a']]        }
, { name:'hset'      , methods:[['hset','hash','a',1]]     , events:[['hset','hash','a',1]     
                                                                    ,['hset hash','a',1]]      }
, { name:'lset'      , methods:[['rpush','mylist','foo']
                               ,['lset','mylist',0,'one']] , events:[['lset','mylist',0,'one']
                                                                    ,['lset mylist',0,'one']]  }
, { name:'set'       , methods:[['set','foo','bar']]       , events:[['set','foo','bar']]      }
, { name:'get'       , methods:[['set','foo','bar']                                            
                               ,['get','foo']]             , events:[['get','foo','bar']]      }
, { name:'swap'      , methods:[['set','a',1]                                            
                               ,['set','b',2]                                            
                               ,['swap','a','b']]          , events:[['swap','a','b',undefined]
                                                                    ,['swap a','b',undefined]] }
, { name:'findin'    , methods:[['set','foo','hello']                                            
                               ,['findin','foo','ll']]     , events:[['findin','foo','ll',2]
                                                                    ,['findin foo','ll',2]] }
]

ME.remote = {}
ME.remote.before = function(done){
  var p = common.plan(2,done)
  var port = ~~(Math.random()*50000)+10000
  common.serverVat = sv()
  common.serverRemotes = []
  common.serverVat.listen(port,function(rem,s){
    common.serverRemotes.push({remote:rem,socket:s})
    p.did()
  })
  common.clientVat = sv()
  common.clientRemotes = []
  common.clientVat.connect(port,function(rem,s){
    common.clientRemotes.push({remote:rem,socket:s})
    p.did()
  })
}
ME.remote.beforeEach = function(done){
  Object.keys(common.serverVat.hash).forEach(function(x){
    delete common.serverVat.hash[x]
  })
  done()
}

remoteSamples.forEach(function(x){
  ME.remote[x.name] = function(done){
    var p = common.plan(0,done)
    if (x.methods) {
      x.methods.forEach(function(m){
        var currM = m.shift()
        common.serverRemotes[0].remote[currM]
          .apply(common.serverRemotes[0].remote,m)
        common.clientRemotes[0].remote[currM]
          .apply(common.clientRemotes[0].remote,m)
      })
    }
    if (x.events) {
      x.events.forEach(function(e){
        p.todo = p.todo+2
        var currE = e.shift()
        common.clientVat.once(currE,function(){
          assert.deepEqual([].slice.call(arguments),e)
          p.did()
        })
        common.serverVat.once(currE,function(){
          assert.deepEqual([].slice.call(arguments),e)
          p.did()
        })
      })
    }
    if (x.eventsOr) {
      p.todo = p.todo+2
      var ee = []
      x.eventsOr.forEach(function(e){
        var currE = e.shift()
        ee.push(currE)
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
      assert.equal(this.event[0],'data')
      assert.equal(this.event[1],'socketvat')
      assert.equal(this.event[2],'event')
      var args = [].slice.call(arguments)
      assert.deepEqual(args,['server','x'])
      if (this.event[3] == 'set') p.did()
      if (this.event[3] == 'get') p.did()
    })
    r.set('server','x')
    r.get('server')
  })

  var clientVat = sv()
  clientVat.connect(port,function(r){
    r.on('*',function(){
      assert.equal(this.event[0],'data')
      assert.equal(this.event[1],'socketvat')
      assert.equal(this.event[2],'event')
      var args = [].slice.call(arguments)
      assert.deepEqual(args,['client','y'])
      if (this.event[3] == 'set') p.did()
      if (this.event[3] == 'get') p.did()
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

ME.tls = function(done) {
  var p = common.plan(2,done)
  var port = ~~(Math.random()*50000)+10000
  var fixturesPath = path.resolve(__dirname+'/../node_modules/nssocket/test/fixtures')
  var opts = { port : port
             , key  : fs.readFileSync(fixturesPath+'/ryans-key.pem')
             , cert : fs.readFileSync(fixturesPath+'/ryans-cert.pem')
             , ca   : fs.readFileSync(fixturesPath+'/ryans-csr.pem')
             }
  var serverVat = sv()
  serverVat.listen(opts,function(rem,s){
    assert.equal(s._type,'tls')
    p.did()
  })
  var clientVat = sv()
  clientVat.connect(opts,function(rem,s){
    assert.equal(s._type,'tls')
    p.did()
  })
}

