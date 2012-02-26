# socketvad

[EventVat] + [nssocket]

[EventVat]: https://github.com/hij1nx/EventVat
[nssocket]: https://github.com/nodejitsu/nssocket

## install

* install node
* `npm install socketvat`
* `npm test socketvat`

## example

    var sv = require('socketvat')
    function ee2log(name){return function(){
      console.log((name || '☼')+':',this.event,'→',[].slice.call(arguments))
    }}
    
    var serverVat = sv()
    serverVat.listen(3000,function(r,s){
      r.onAny(ee2log('serverRemote **'))
      r.on('error',function(){})
      r.on('end',function(){})
      r.set('server','x')
    })
    
    var clientVat = sv()
    clientVat.connect(3000,function(r){
      r.onAny(ee2log('clientRemote **'))
      r.set('client','y',function(err){console.log('sent the message')})
      r.get('client')
      r.keys('client')
    })
    
    serverVat.on('*',ee2log('serverVat'))
    clientVat.on('*',ee2log('serverVat'))
    
    serverVat.set('foo','bar')
    clientVat.set('foo','bar')
    
output:

    serverVat: set → [ 'foo', 'bar' ]
    serverVat: set → [ 'foo', 'bar' ]
    sent the message
    serverVat: set → [ 'client', 'y' ]
    serverVat: get → [ 'client', 'y' ]
    serverVat: keys → [ [ 'client' ], /client/ ]
    serverVat: set → [ 'server', 'x' ]
    clientRemote **: [ 'data', 'socketvat', 'event', 'set', 'client' ] → [ 'y' ]
    clientRemote **: [ 'data', 'socketvat', 'event', 'set' ] → [ 'client', 'y' ]
    clientRemote **: [ 'data', 'socketvat', 'event', 'get', 'client' ] → [ 'y' ]
    clientRemote **: [ 'data', 'socketvat', 'event', 'get' ] → [ 'client', 'y' ]
    clientRemote **: [ 'data', 'socketvat', 'event', 'keys' ] → [ [ 'client' ], 'client' ]
    serverRemote **: [ 'data', 'socketvat', 'event', 'set', 'server' ] → [ 'x' ]
    serverRemote **: [ 'data', 'socketvat', 'event', 'set' ] → [ 'server', 'x' ]

