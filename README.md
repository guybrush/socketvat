# socketvad

[EventVat] + [nssocket]

[EventVat]: https://github.com/hij1nx/EventVat
[nssocket]: https://github.com/nodejitsu/nssocket

## install

* install node
* `npm install socketvat`
* `npm test socketvat`

## example

``` javascript
var sv = require('socketvat')

var charm = require('charm')(process)

function ee2log(name){return function(){
  var event = Array.isArray(this.event) ? this.event : this.event.split(' ')
  var colorMap = 
  {'serverVat **':'cyan','serverRemote **':'yellow','serverSocket **':'white'
  ,'clientVat **':'cyan','clientRemote **':'yellow','clientSocket **':'white'}
  var color = colorMap[name] ? colorMap[name] : 'white'
  charm.foreground(color)
       .write((name || '☼'))
       .column(17).write(' : ').column(20).write(JSON.stringify(event))
       .column(64).write(' → ').column(67).write(JSON.stringify([].slice.call(arguments)))
       .foreground('white')
       .write('\n')
}}

var serverVat = sv()
var server = serverVat.listen(3000,function(r,s){
  r.onAny(ee2log('serverRemote **'))
  s.onAny(ee2log('serverSocket **'))
  s.on('error',function(err){console.log('socket error',err)})
  s.on('close',function(){
    console.log('---- client disconnected')
    server.close()
    process.exit()
  })
  r.set('server','x')
})

var clientVat = sv()
clientVat.connect(3000,function(r,s){
  r.onAny(ee2log('clientRemote **'))
  s.onAny(ee2log('clientSocket **'))
  r.set('client','y',function(err){console.log('---- sent the message')})
  r.get('client')
  r.keys('client')
  setTimeout(function(){s.end()},100)
})

serverVat.on('**',ee2log('serverVat **'))
serverVat.once('set client',function(){
  console.log('---- serverVat once set *:',this.event,'→',[].slice.call(arguments))
})

clientVat.on('**',ee2log('clientVat **'))
clientVat.once('set *',function(){
  console.log('---- clientVat once set *:',this.event,'→',[].slice.call(arguments))
})

serverVat.set('foo','bar')
clientVat.set('foo','bar')
```

output:

```
serverVat **     : ["set","foo"]                                → ["bar"]
serverVat **     : ["set"]                                      → ["foo","bar"]
---- clientVat once set *: set foo → [ 'bar' ]
clientVat **     : ["set","foo"]                                → ["bar"]
clientVat **     : ["set"]                                      → ["foo","bar"]
clientSocket **  : ["start"]                                    → []
---- sent the message
serverSocket **  : ["start"]                                    → []
serverSocket **  : ["data","socketvat","method","onAny"]        → [null]
serverSocket **  : ["data","socketvat","method","set"]          → [{"args":["client","y"]}]
---- serverVat once set *: set client → [ 'y' ]
serverVat **     : ["set","client"]                             → ["y"]
serverVat **     : ["set"]                                      → ["client","y"]
serverSocket **  : ["data","socketvat","method","get"]          → [{"args":["client"]}]
serverVat **     : ["get","client"]                             → ["y"]
serverVat **     : ["get"]                                      → ["client","y"]
serverSocket **  : ["data","socketvat","method","keys"]         → [{"args":["client"]}]
serverVat **     : ["keys"]                                     → [["client"],{}]
clientSocket **  : ["data","socketvat","method","onAny"]        → [null]
clientSocket **  : ["data","socketvat","method","set"]          → [{"args":["server","x"]}]
clientVat **     : ["set","server"]                             → ["x"]
clientVat **     : ["set"]                                      → ["server","x"]
clientSocket **  : ["data","socketvat","event","set","client"]  → [{"args":["y"]}]
clientRemote **  : ["set","client"]                             → ["y"]
clientSocket **  : ["data","socketvat","event","set"]           → [{"args":["client","y"]}]
clientRemote **  : ["set"]                                      → ["client","y"]
clientSocket **  : ["data","socketvat","event","get","client"]  → [{"args":["y"]}]
clientRemote **  : ["get","client"]                             → ["y"]
clientSocket **  : ["data","socketvat","event","get"]           → [{"args":["client","y"]}]
clientRemote **  : ["get"]                                      → ["client","y"]
clientSocket **  : ["data","socketvat","event","keys"]          → [{"args":[["client"],"client"]}]
clientRemote **  : ["keys"]                                     → [["client"],"client"]
serverSocket **  : ["data","socketvat","event","set","server"]  → [{"args":["x"]}]
serverRemote **  : ["set","server"]                             → ["x"]
serverSocket **  : ["data","socketvat","event","set"]           → [{"args":["server","x"]}]
serverRemote **  : ["set"]                                      → ["server","x"]
clientSocket **  : ["close"]                                    → [null]
serverSocket **  : ["close"]                                    → []
---- client disconnected
```
