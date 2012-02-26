module.exports = socketvat

var EE2 = require('eventemitter2').EventEmitter2
var nss = require('nssocket')
var ev  = require('eventvat')
var net = require('net')
var tls = require('tls')

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

p.listen = function() {
  var args = [].slice.call(arguments)
  var cb = typeof args[args.length-1] == 'function'
           ? args[args.length-1]
           : function(){}
  var opts = {tls:{}}
  args.forEach(function(x){
    if (typeof x === 'string') opts.host = x
    else if (typeof x === 'number') opts.port = x
    else if (typeof x === 'object') {
      if (x.__proto__ === Object.prototype) {
        Object.keys(x).forEach(function(k){
          switch(k) {
            case 'port'               : opts[k]     = x[k]; break;
            case 'host'               : opts[k]     = x[k]; break;
            case 'key'                : opts.tls[k] = x[k]; break;
            case 'cert'               : opts.tls[k] = x[k]; break;
            case 'ca'                 : opts.tls[k] = x[k]; break;
            case 'passphrase'         : opts.tls[k] = x[k]; break;
            case 'ciphers'            : opts.tls[k] = x[k]; break;
            case 'requestCert'        : opts.tls[k] = x[k]; break;
            case 'rejectUnauthorized' : opts.tls[k] = x[k]; break;
            case 'NPNProtocols'       : opts.tls[k] = x[k]; break;
            case 'SNICallback'        : opts.tls[k] = x[k]; break;
            case 'sessionIdContext'   : opts.tls[k] = x[k]; break;
            default : console.error(new Error('invalid option "'+k+'"'))
          }
        })
      }
    }
  })

  opts.host = opts.host || '0.0.0.0'
  if (!opts.port) throw new Error('no port defined')

  var self = this
  var server
  if (opts.tls.key && opts.tls.cert){
    opts.tls.type = 'tls'
    server = nss.createServer(opts.tls,function(s){self.initSocket(s,cb)})
  }
  else
    server = nss.createServer(function(s){self.initSocket(s,cb)})
  server.listen(opts.port,opts.host)
  return server
}

p.connect = function() {
  var args = [].slice.call(arguments)
  var cb = typeof args[args.length-1] == 'function'
           ? args[args.length-1]
           : function(){}
  var opts = {tls:{}}
  args.forEach(function(x){
    if (typeof x === 'string') opts.host = x
    else if (typeof x === 'number') opts.port = x
    else if (typeof x === 'object') {
      if (x.__proto__ === Object.prototype) {
        Object.keys(x).forEach(function(k){
          switch(k) {
            case 'port'         : opts[k]     = x[k]; break;
            case 'host'         : opts[k]     = x[k]; break;
            case 'key'          : opts.tls[k] = x[k]; break;
            case 'cert'         : opts.tls[k] = x[k]; break;
            case 'ca'           : opts.tls[k] = x[k]; break;
            case 'passphrase'   : opts.tls[k] = x[k]; break;
            case 'NPNProtocols' : opts.tls[k] = x[k]; break;
            case 'servername'   : opts.tls[k] = x[k]; break;
            case 'socket'       : opts.tls[k] = x[k]; break;
            default : console.error(new Error('invalid option "'+k+'"'))
          }
        })
      }
    }
  })

  opts.host = opts.host || '0.0.0.0'
  if (!opts.port) throw new Error('no port defined')

  var self = this
  var client
  if (opts.tls.key && opts.tls.cert) {
    opts.tls.type = 'tls'
    client = new nss.NsSocket(opts.tls)
  }
  else
    client = new nss.NsSocket()

  client.connect(opts.port, opts.host)
  self.initSocket(client,cb)
  return client
}

p.initSocket = function(s,cb) {
  var self = this
  s.data(self.namespace+'::**',function(d){
    var method = this.event[2] == 'method' ? this.event[3] : null
    var event  = this.event[2] == 'event'  ? this.event[3] : null
    var args = this.event.slice(4)
    if (arguments) {
      args = args.concat([].slice.call(arguments))
      if (args[args.length-1] === null) args.pop()
    }
    d = d || {}
    args = d.args || []
    //if (method) console.log('REMOTE WANTS TO '+method,args)
    //if (event) console.log('REMOTE DID '+event,args)
    if (method) {
      switch (method) {
        case 'onAny':
          self.onAny(function(){
            var split = this.event.split(' ')
            var args = [].slice.call(arguments)
            if (split[0] == 'keys') args[args.length-1] = args[args.length-1].source
            var event = [self.namespace,'event'].concat(split)
            s.send(event,{args:args})
          })
          break
        case 'on':
        case 'subscribe':
          args[0] = args[0].split('::').join(' ')
          self.on(args[0],function(){
            var split = this.event.split(' ')
            var args = [].slice.call(arguments)
            if (split[0] == 'keys') args[args.length-1] = args[args.length-1].source
            var event = [self.namespace,'event'].concat(split)
            s.send(event,{args:args})
          })
          break
        case 'once':
          args[0] = args[0].split('::').join(' ')
          self.once(args[0],function(){
            var split = this.event.split(' ')
            var args = [].slice.call(arguments)
            if (split[0] == 'keys') args[args.length-1] = args[args.length-1].source
            var event = [self.namespace,'event'].concat(split)
            s.send(event,{args:args})
          })
          break
        case 'unsubscribe':
          // #TODO
          break
        case 'keys':
          var regex = (new RegExp(args[0]))
          self.keys(regex)
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
  r.on = r.subscribe = function(event,cb,_cb){
    event = event.split(' ').join('::')
    s.data(self.namespace+'::event::'+event,function(d){
      this.event = this.event.slice(3).join(' ') // not sure about that 
      cb.apply(this,d.args)
    })
    s.send([self.namespace,'method','on'],{args:[event]},_cb)
  }
  r.once = function(event,cb,_cb){
    event = event.split(' ').join('::')
    s.dataOnce(self.namespace+'::event::'+event,function(d){   
      this.event = this.event.slice(3).join(' ') // not sure about that 
      cb.apply(this,d.args)
    })
    s.send([self.namespace,'method','once'],{args:[event]},_cb)
  }
  r.onAny = function(cb,_cb){
    s.data(self.namespace+'::event::**',function(d){
      this.event = this.event.slice(3).join(' ') // not sure about that 
      cb.apply(this,d.args)
    })
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
      // s.send([self.namespace,'method',m].concat(args),cb)
      s.send([self.namespace,'method',m],{args:args},cb)
    }
  })
  cb && cb(r,s)
}
