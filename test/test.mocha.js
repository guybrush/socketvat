var sv = require('../socketvat')
var assert = require('assert')

function plan(todo,cb) {
  if (!(this instanceof plan)) return new plan(todo,cb)
  var self = this
  self.todo = todo
  self.did = function(e) {if (--self.todo<=0) cb && cb(e)}
}

module.exports =
{ 'simple': function(done){
    var p = plan(10,done)
    var port = ~~(Math.random()*50000)+10000
    var serverVat = sv()
    serverVat.listen(port,function(r){
      r.on('*',function(d){
        assert.equal(this.event[0],'data')
        assert.equal(this.event[1],'socketvat')
        assert.equal(this.event[2],'event')
        assert.equal(d,'x')
        if (this.event[3] == 'set' && this.event[4] == 'server') p.did()
        if (this.event[3] == 'get' && this.event[4] == 'server') p.did()
      })
      r.set('server','x') 
      r.get('server')   
    })                              
    
    var clientVat = sv()
    clientVat.connect(port,function(r){
      r.on('*',function(d){
        assert.equal(this.event[0],'data')
        assert.equal(this.event[1],'socketvat')
        assert.equal(this.event[2],'event')
        assert.equal(d,'y')
        if (this.event[3] == 'set' && this.event[4] == 'client') p.did()
        if (this.event[3] == 'get' && this.event[4] == 'client') p.did()
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
}

