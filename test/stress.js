console.log
( [ 'this is a "stress"-test for socketvat it will start either a '
  , 'socketvat-server or repeatedly (`-i`) start `-n` socketvat-clients - '
  , 'depending on what cli-options you pass to the programm.'
  , ''
  , 'start the stress-server:'
  , ''
  , '    ./stress.js -p 3000'
  , ''
  , 'repeatedly start 20 clients every 200ms which will disconnect after 2000ms:'
  , ''
  , '    ./stress.js clients -p 3000 -i 200 -t 2000 -n 20'
  , ''
  ].join('\n')
)

var _startClients = !!~process.argv.indexOf('clients')

var sv = require('../socketvat')  
var _I = 0          // counter
var _C = {}         // clients  
var _t = ~process.argv.indexOf('-t')
         ? process.argv[process.argv.indexOf('-t')+1]
         : 2000
var _p = ~process.argv.indexOf('-p')
         ? process.argv[process.argv.indexOf('-p')+1]
         : 553784
var _n = ~process.argv.indexOf('-n')
         ? process.argv[process.argv.indexOf('-n')+1]
         : 1
var _i = ~process.argv.indexOf('-i')
         ? process.argv[process.argv.indexOf('-i')+1]
         : 1000

console.log('--------------------------------')
console.log({time:Date(_t).toString(),port:_p,t:_t,n:_n,i:_i})
console.log('--------------------------------')
setInterval(function(){
  console.log
  ( _startClients ? 'clients' : 'server'
  , { t:~~(process.uptime())+'sec'
    , RSS:process.memoryUsage().rss/1024+'kB'
    , i:_I
    , c:Object.keys(_C).length
    } )
},1000)

if (_startClients) {
  setInterval(function(){
    createClients(_n)
  },_i)
}
else {
  var s = sv()
  var j = 0
  setInterval(function(){
    s.set('x',j++)
  },200)
  s.listen(_p,function(r,sock){
    var i = _I++
    _C[i] = r
    var iv = setInterval(function(){
      r.set('x',j)
    },200)
    sock.on('close',function(){
      clearInterval(iv)
      delete _C[i]  
    })
  })
}

function createClients(n) {
  if (n) for (var j=1;j<n;j++) createClients() 
  var i = _I++
  var c = _C[i] = sv()
  var j = 0
  var iv1 = setInterval(function(){
    c.set('foo',j++)
  },200)
  var cc = c.connect(_p,function(r){
    var iv2 = setInterval(function(){
      r.set('client'+i,j)
    },200)
    setTimeout(function(){
      clearInterval(iv1)
      clearInterval(iv2)
      cc.end()
      cc.on('close',function(){
        cc.destroy()
        delete _C[i]                                           
      })
    },_t)
  })
}
