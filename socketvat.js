module.exports = socketvat

var EE2 = require('eventemitter2').EventEmitter2
var nss = require('nssocket')
var ev  = require('eventvat')
var net = require('net')
var tls = require('tls')
var debug = require('debug')('socketvat')

function socketvat(opts) {
  if (!(this instanceof socketvat)) return new socketvat(opts)
  EE2.call(this,{wildcard:true,delimiter:' '})
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
           ? args.pop()
           : function(){}
  var opts = {tls:{}}
  args.forEach(function(x){
    if (typeof x === 'string') opts.host = x
    else if (typeof x === 'number') opts.port = x
    else if (typeof x === 'object') {
      if (x.__proto__ === Object.prototype) {
        Object.keys(x).forEach(function(k){
          switch(k) {
            case 'port' :
            case 'host' :
              opts[k] = x[k]; break;
            case 'key' :
            case 'cert' :
            case 'ca' :
            case 'passphrase' :
            case 'ciphers' :
            case 'requestCert' :
            case 'rejectUnauthorized' :
            case 'NPNProtocols' :
            case 'SNICallback' :
            case 'sessionIdContext' :
              opts.tls[k] = x[k]; break;
            default :
              console.error(new Error('invalid option "'+k+'"'))
          }
        })
      }
    }
  })

  if (!opts.port && !opts.host)
    throw new Error('no port or path defined')

  if (opts.port) opts.host = opts.host || '0.0.0.0'
  else opts.path = opts.host

  var self = this
  var server
  if (opts.path) {
    server = nss.createServer(function(s){self.initSocket(s,cb)})
    server.listen(opts.path)
  }
  else if (opts.tls.key && opts.tls.cert){
    opts.tls.type = 'tls'
    // server = nss.createServer(opts.tls,function(s){self.initSocket(s,cb)})
    server = tls.createServer(opts.tls,function(s){
      var nssServer = new nss.NsSocket(s,{type:'tcp4'}) // not sure about that
      s.on('end',function(){console.log('end?')})
      s.on('end',function(){console.log('end?')})
      self.initSocket(nssServer,cb)
    })
    server.listen(opts.port,opts.host)
  }
  else {
    server = nss.createServer(function(s){self.initSocket(s,cb)})
    server.listen(opts.port,opts.host)
  }
  return server
}

p.connect = function() {
  debug('connect')
  var self = this
  var _args = [].slice.call(arguments)
  var args = [].slice.call(arguments)
  this.onConnect = typeof args[args.length-1] == 'function'
                 ? args.pop()
                 : function(){}
  var opts = {tls:{}}
  args.forEach(function(x){
    if (typeof x === 'string') opts.host = x
    else if (typeof x === 'number') opts.port = x
    else if (typeof x === 'object') {
      if (x.__proto__ === Object.prototype) {
        Object.keys(x).forEach(function(k){
          switch(k) {
            case 'port' :
            case 'host' :
            case 'reconnect' :
              opts[k] = x[k]; break;
            case 'key' :
            case 'cert' :
            case 'ca' :
            case 'passphrase' :
            case 'NPNProtocols' :
            case 'servername' :
            case 'socket' :
              opts.tls[k] = x[k]; break;
            default :
              console.error(new Error('invalid option "'+k+'"'))
          }
        })
      }
    }
  })
  
  if (!opts.port && !opts.host)
    throw new Error('no port or path defined')

  if (opts.port) opts.host = opts.host || '0.0.0.0'
  else opts.path = opts.host

  var self = this
  var client
  if (opts.path) {
    client = new nss.NsSocket()
    client.connect(opts.path,function(){
      self.initSocket(client,self.onConnect)
      if (opts.reconnect) applyReconnect()
    })
  }
  else if (opts.tls.key && opts.tls.cert) {
    client = tls.connect(opts.port,opts.host,opts.tls,function(){
      var nssClient = new nss.NsSocket(client,{type:'tcp4'})
      self.initSocket(nssClient,self.onConnect)
      if (opts.reconnect) applyReconnect()
    })
  }
  else {
    client = new nss.NsSocket()
    client.connect(opts.port, opts.host, function(){
      self.initSocket(client,self.onConnect)
      if (opts.reconnect) applyReconnect()
    })
  }
  client.on('error', function (err) {
    debug('client error')
    if (opts.reconnect) {
      if (err.code === 'ECONNREFUSED') {
        self.emit('refused')
        debug('ECONNREFUSED')
        setTimeout(function () {
          self.emit('reconnecting')
          socketvat.prototype.connect.apply(self, _args)
        }, opts.reconnect)
      }
    }
  })
  function applyReconnect() {
    debug('apply reconnect')
    client.once('close', function () {
      debug('socket closed')
      client.destroy()
      setTimeout(function () {
        debug('reconnecting')
        self.emit('reconnecting')
        socketvat.prototype.connect.apply(self, _args)
      }, opts.reconnect)
    })   
  }
  return client
}

p.initSocket = function(s,cb) {
  debug('init socket')
  var self = this
  this.sockets.push(s)
  var subs = {}
  var subsListners = {}
  function sub(x) {
    x = x || '**'
    debug('subscribing',x)
    if (!subs[x]) {
      subs[x] = function(d) {
        var args = [].slice.call(arguments)
        var split = this.event.split(' ')
        if (split[0] == 'keys')
          args[args.length-2] = args[args.length-2].source
        var event = [self.namespace,'event'].concat(split)
        if (!s.socket.writable) return unsub()
        s.send(event,{args:args})
      }
      self.on(x,subs[x])
    }
  }
  function unsub(x) {
    Object.keys(subs).forEach(function(y){
      if (x && x!=y) return
      debug('unsubscribing',y)
      self.removeListener(y,subs[y])
      delete subs[y]
    })
  }
  function destroySocket() {
    debug('destroy socket')
    unsub()
    s.destroy()
    self.sockets.splice(self.sockets.indexOf(s),1)
  }
  
  s.on('error',function(err){
    debug('socket-error',err)
    destroySocket()
  })
  s.on('close',function(){
    debug('socket-close')
    destroySocket()
  })
  s.on('end',function(){
    debug('socket-end')
    destroySocket()
  })
  s.on('timeout',function(){
    debug('socket-timeout')
    destroySocket()
  })
  s.data(self.namespace+'::**',function(d){
    d = d || {}
    var args = d.args || []
    var method = this.event[2] == 'method' ? this.event[3] : null
    var event  = this.event[2] == 'event'  ? this.event[3] : null
    if (method) debug('data-method',method,args)
    if (event) debug('data-event',event,args)
    if (method) {
      switch (method) {
        case 'onAny':
          sub('**')
          break
        case 'on':
        case 'subscribe':
          args[0] = args[0].split('::').join(' ')
          sub(args[0])
          break
        case 'once':
          args[0] = args[0].split('::').join(' ')
          self.once(args[0],function(){
            var args = [].slice.call(arguments)
            var split = this.event.split(' ')
            // if (split[0] == 'keys') args[args.length-2] = args[args.length-2].source
            var event = [self.namespace,'event'].concat(split)
            s.send(event,{args:args})
          })
          break
        case 'offAny':
          unsub('**')
          break
        case 'removeListener':
        case 'off':
        case 'unsubscribe':
          args[0] = args[0].split('::').join(' ')
          unsub(args[0])
          break
        case 'keys':
          var regex
          try {
            regex = (new RegExp(args[0]))
          } catch (e) {
            console.error(e)
          }
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
  // console.log(Object.keys(ev.prototype))
  ;[ 'die', 'del', 'exists', 'expire', 'expireat', /*'keys', 'move', 'object'*/
   , 'persist', 'randomkey', 'rename', 'renamenx', /*'sort', 'type'*/, 'ttl'
   , 'append', 'decr', 'decrby', 'get'/*, 'getbit'*/, 'getrange', 'getset', 'incr'
   , 'incrby', 'mget', 'mset', 'msetnx', 'set'/*, 'setbit', 'setex'*/, 'setnx'
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
  r.keys = function(){
    var args = [].slice.call(arguments)
    if (args[0] instanceof RegExp) args[0] = args[0].source
    s.send([self.namespace,'method','keys'],{args:args})
  }
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
    s.send([self.namespace,'method','onAny'],{args:[]},_cb)
  }
  r.off = r.unsubscribe = function(event,_cb){
    event = event.split(' ').join('::')
    debug('sending','unsubscribe',event)
    s.send([self.namespace,'method','unsubscribe'],{args:[event]},_cb)
  }
  r.offAny = function(_cb){
    s.send([self.namespace,'method','offAny'],{args:[]},_cb)
  }
  cb && cb(r,s)
}

socketvat.listen = function(opts,cb){
  var s = socketvat()
  return socketvat.prototype.listen.call(s,opts,cb)
}

socketvat.connect = function(opts,cb){
  var s = socketvat()
  return socketvat.prototype.connect.call(s,opts,cb)
}
