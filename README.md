# socketvat

[EventVat] + [nssocket]

[EventVat]: https://github.com/hij1nx/EventVat
[nssocket]: https://github.com/nodejitsu/nssocket

## install

* install node
* `npm install socketvat`
* `npm test socketvat`
* `DEBUG=socketvat,test npm test socketvat`

## api

### sv = socketvat(`opts`)

* `instanceof sv === require('eventvat')`
* `opts.namespace` - default: `socketvat` - will be used to prefix every event
  which will be sent to remote socket, also it will only listen for remote 
  events prefixed by that namespace

### sv.listen(`<arg1>`[,`<arg2>`[,`<arg3>`]],[`<listener>`])

this will start a `net` or `tls`-Server

* `<arg1>`, `<arg2>`, `<arg3>`
    * `Int` → `port`
    * `String` → `host` (or `path` if no port is defined, start a 
      unix-socket-server)
    * `Object`
        * `port` → `port`
        * `host` → `host`
        * `key` → start `tls`-Server with that key
        * `cert` → start `tls`-Server with that cert
        * `ca` → start `tls`-Server with that ca
        
* `<listener>`
    * `Function` → connection-listener, will be called with 2 arguments:
        * a object with helper-functions for communication with remote socketvat
        * an instance of `require('nssocket').NsSocket`

### sv.connect(`<arg1>`[,`<arg2>`[,`<arg3>`]],[`<listener>`])

this will create a `net` or `tls`-Connection

* `<arg1>`, `<arg2>`, `<arg3>`
    * `Int` → `port`
    * `String` → `host` (or `path` if no port is defined, start a 
      unix-socket-connection)
    * `Object`
        * `port` → `port`
        * `host` → `host`
        * `key` → start `tls`-Connection with that key
        * `cert` → start `tls`-Connection with that cert
        * `reconnect` → upon connection -drop or -error, connect again in 
          `opts.reconnect` milliseconds
        
* `<listener>`
    * `Function` → connection-listener, will be called with 2 arguments:
        * a object with helper-functions for communication with remote socketvat
        * an instance of `require('nssocket').NsSocket`

### sv.initSocket(`<socket>`[,`<cb>`])

`<socket>` hast to be an instance of `require('nssocket').NsSocket`

```
var nss = require('nssocket')
var sv = require('socketvat')
var serverVat = sv()
var clientVat = sv()
var s = nss.createServer(function(s){serverVat.initSocket(s)})
s.listen(4545)
var c = new nss.NsSocket()
clientVat.initSocket(c)
c.connect(4545)
```
        
### communication with remote socketvat

```
var s = require('socketvat')()
var assert = require('assert')
s.set('foo','server')
s.listen(3000,function(remote,socket){
  remote.once('get',function(k,v){
    assert.equal(k,'foo')
    assert.equal(k,'client')
  })
  remote.get('foo')
})
var c = sv()
c.set('foo','client')
c.connect(3000,function(remote,socket){
  remote.once('get',function(k,v){
    assert.equal(k,'foo')
    assert.equal(k,'server')
  })
  remote.get('foo')
})
```

## example

``` javascript
var sv = require('socketvat')

var serverVat = sv()
var server = serverVat.listen(3000,function(r,s){
  r.onAny(ee2log('serverRemote'))
  s.onAny(ee2log('serverSocket'))
  s.on('error',function(err){console.log('socket error',err)})
  s.on('close',function(){
    console.log('---- client disconnected')
    server.close()
    process.exit()
  })
  r.set('server','x')
})

var clientVat = sv()
var client = clientVat.connect(3000,function(r,s){
  r.onAny(ee2log('clientRemote'))
  s.onAny(ee2log('clientSocket'))
  r.set('client','y',function(err){console.log('---- sent the message')})
  r.get('client')
  r.keys('client')
  setTimeout(function(){s.end()},100)
})

serverVat.on('**',ee2log('serverVat'))
serverVat.once('set client',function(){
  console.log('---- serverVat once set *:',this.event,'→',[].slice.call(arguments))
})

clientVat.on('**',ee2log('clientVat'))
clientVat.once('set *',function(){
  console.log('---- clientVat once set *:',this.event,'→',[].slice.call(arguments))
})

serverVat.set('foo','bar')
clientVat.set('foo','bar')

function ee2log(name){return function(){
  name = name || '•'
  name = name+Array(13).slice(name.length).join(' ')
  var event = Array.isArray(this.event) ? this.event.join(' ') : this.event
  event = event+Array(32).slice(event.length).join(' ')
  console.log(name,':',event,'→',[].slice.call(arguments))
}}
```

output:

```
serverVat    : set foo                         → [ 'bar' ]
serverVat    : set                             → [ 'foo', 'bar' ]
---- clientVat once set *: set foo → [ 'bar' ]
clientVat    : set foo                         → [ 'bar' ]
clientVat    : set                             → [ 'foo', 'bar' ]
clientSocket : start                           → []
---- sent the message
serverSocket : start                           → []
serverSocket : data socketvat method onAny     → [ { args: [] } ]
serverSocket : data socketvat method set       → [ { args: [ 'client', 'y' ] } ]
---- serverVat once set *: set client → [ 'y' ]
serverVat    : set client                      → [ 'y' ]
serverVat    : set                             → [ 'client', 'y' ]
serverSocket : data socketvat method get       → [ { args: [ 'client' ] } ]
serverVat    : get client                      → [ 'y' ]
serverVat    : get                             → [ 'client', 'y' ]
serverSocket : data socketvat method keys      → [ { args: [ 'client' ] } ]
serverVat    : keys                            → [ [ 'client' ], /client/ ]
clientSocket : data socketvat method onAny     → [ { args: [] } ]
clientSocket : data socketvat method set       → [ { args: [ 'server', 'x' ] } ]
clientVat    : set server                      → [ 'x' ]
clientVat    : set                             → [ 'server', 'x' ]
clientSocket : data socketvat event set client → [ { args: [ 'y' ] } ]
clientRemote : set client                      → [ 'y' ]
clientSocket : data socketvat event set        → [ { args: [ 'client', 'y' ] } ]
clientRemote : set                             → [ 'client', 'y' ]
clientSocket : data socketvat event get client → [ { args: [ 'y' ] } ]
clientRemote : get client                      → [ 'y' ]
clientSocket : data socketvat event get        → [ { args: [ 'client', 'y' ] } ]
clientRemote : get                             → [ 'client', 'y' ]
clientSocket : data socketvat event keys       → [ { args: [ [Object], 'client' ] } ]
clientRemote : keys                            → [ [ 'client' ], 'client' ]
serverSocket : data socketvat event set server → [ { args: [ 'x' ] } ]
serverRemote : set server                      → [ 'x' ]
serverSocket : data socketvat event set        → [ { args: [ 'server', 'x' ] } ]
serverRemote : set                             → [ 'server', 'x' ]
clientSocket : close                           → [ undefined ]
serverSocket : close                           → []
---- client disconnected
```

