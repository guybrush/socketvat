var sv = require('../socketvat')

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
