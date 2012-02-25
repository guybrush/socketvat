module.exports = socketvat

var EE2 = require('eventemitter2').EventEmitter2
var nss = require('nssocket')
var ev  = require('eventvat')
var net = require('net')
var tls = require('tls')
var fs  = require('fs')

function socketvat(opts) {
  if (!(this instanceof socketvat)) return new socketvat(opts)
  EE2.call(this,{wildcard:true,delimiter:' ',maxListeners:0})
  ev.call(this)
  opts = opts || {}
  this.namespace = opts.namespace || 'socketvat'
  this.sockets = []
  return this
}

var p = socketvat.prototype = new ev

p.listen = function(port,cb) {
  var self = this
  var server = nss.createServer(function(s){
    self.initSocket(s,cb)
  })
  server.listen(port)
  return server
}

p.connect = function(port,cb) {
  var self = this
  var client = new nss.NsSocket()
  client.connect(port)
  self.initSocket(client,cb)
  return client
}

p.initSocket = function(s,cb) {
  var self = this
  s.data(self.namespace+'::**',function(){
    var method = this.event[2] == 'method' ? this.event[3] : null
    var event  = this.event[2] == 'event'  ? this.event[3] : null
    var args = this.event.slice(4)
    if (arguments) args = args.concat([].slice.call(arguments))
    // if (method) console.log('REMOTE WANTS TO '+method,args)
    // if (event) console.log('REMOTE DID '+event,args)
    if (method) {
      switch (method) {
        case 'onAny':
          self.onAny(function(){
            var event = [self.namespace,'event']
                          .concat(this.event.split(' '))
                          .concat([].slice.call(arguments))
            var data = event.pop()
            s.send(event,data)
          })
          break
        case 'on':
        case 'subscribe':
          args[0] = args[0].split('::').join(' ')
          self.on(args[0],function(){
            var event = [self.namespace,'event']
                          .concat(this.event.split(' '))
                          .concat([].slice.call(arguments))
            var data = event.pop()
            s.send(event,data)
          })
          break
        case 'unsubscribe':
          // #TODO
          break
        default: 
          if (ev.prototype[method] && typeof ev.prototype[method] == 'function')
            self[method].apply(self,args)
          else
            console.log('unknown method',method) 
      }
    }
  })
  var r = {}
  r.once = function(event,cb,_cb){
    event = event.split(' ').join('::')
  }
  r.on = r.subscribe = function(event,cb,_cb){
    event = event.split(' ').join('::')
    s.data(self.namespace+'::event::'+event+'::**',cb)
    s.send([self.namespace,'method','on'],event,_cb)
  }
  r.onAny = function(cb,_cb){
    s.data(self.namespace+'::event::**',cb)
    s.send([self.namespace,'method','onAny'],_cb)
  }
  r.unsubscribe = function(){} // #TODO
  ;[ 'die', 'del', 'exists', 'expire', 'expireat', 'keys', 'move', 'object'
   , 'persist', 'randomkey', 'rename', 'renamenx', 'sort', 'type', 'ttl'
   , 'append', 'decr', 'decrby', 'get', 'getbit', 'getrange', 'getset', 'incr'
   , 'incrby', 'mget', 'mset', 'msetnx', 'set', 'setbit', 'setex', 'setnx'
   , 'setrange', 'strlen', 'hdel', 'hexists', 'hget', 'hgetall', 'hincr'
   , 'hincrby', 'hdecr', 'hdecrby', 'hkeys', 'hlen', 'hmget' , 'hmset', 'hset'
   , 'hsetnx', 'hvals', 'lindex', 'linsert', 'llen', 'lpop', 'lpush', 'lpushx'
   , 'lrange', 'lrem', 'lset', 'ltrim', 'rpop', 'rpoplpush', 'rpush', 'rpushx'
   , 'dump', 'swap', 'findin'
   ].forEach(function(m){
    r[m] = function(){
      var args = [].slice.call(arguments)
      var cb = typeof args[args.length-1] == 'function'
               ? args.pop() : null
      s.send([self.namespace,'method',m].concat(args),cb)
    }
  })
  cb && cb(r,s)
}

/* * /

console.log(Object.keys(ev.prototype))

var sv = socketvat

var serverVat = sv()
serverVat.listen(3000,function(r,s){
  r.on('**',function(){
    console.log('REMOTE CLIENT:',this.event,'→',[].slice.call(arguments))
  })
  r.on('error',function(){})
  r.on('end',function(){})
  r.set('server','x')   
})                              

var clientVat = sv()
clientVat.connect(3000,function(r){
  r.on('*',function(){
    console.log('REMOTE SERVER:',this.event,'→',[].slice.call(arguments))
  })
  r.set('client','y',function(err){console.log('sent the message')}) 
  r.get('client')
})

serverVat.on('*',function(){
    console.log('LOCAL SERVER:',this.event,'→',[].slice.call(arguments))
  })
clientVat.on('*',function(){
    console.log('LOCAL CLIENT:',this.event,'→',[].slice.call(arguments))
  })

serverVat.set('foo','bar')
clientVat.set('foo','bar')

/* */
