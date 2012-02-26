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
    self.did = function(e) {if (--self.todo<=0) cb && cb(e)}
  }
, scenario: function(opts,done) {
    //console.log(opts)
    var events = Object.keys(opts.events)
    var p = common.plan(0,done)
    events.forEach(function(i){
      Object.keys(opts.events[i]).forEach(function(x){
        p.todo = p.todo+2
        common.clientVat.once(x,function(d){
          assert.equal(d,opts.events[i][x])
          p.did()
        })
        common.serverVat.once(x,function(d){
          assert.equal(d,opts.events[i][x])
          p.did()
        })
      })
    })
    common.serverRemotes[0].remote[opts.method].apply(common.serverRemotes[0].remote,opts.args)
    common.clientRemotes[0].remote[opts.method].apply(common.clientRemotes[0].remote,opts.args)
  }
}

module.exports =
{ remote: 
  { before: function(done){
      var p = common.plan(2,done)
      common.serverVat = sv()
      //common.serverVat.onAny(common.ee2log('serverVatAny'))
      common.serverRemotes = []
      common.serverVat.listen(common.ports[0],function(rem,s){
        common.serverRemotes.push({remote:rem,socket:s})
        p.did()
      })
      common.clientVat = sv()
      //common.clientVat.onAny(common.ee2log('clientVatAny'))
      common.clientRemotes = []
      common.clientVat.connect(common.ports[0],function(rem,s){
        common.clientRemotes.push({remote:rem,socket:s})
        p.did()
      })
    }
  , set: function(done){common.scenario({method:'set',args:['foo','bar'],events:[{'set foo':'bar'}]},done)}
  , get: function(done){common.scenario({method:'get',args:['foo'],events:[{'get foo':'bar'}]},done)}
  }
, 'simple set/get': function(done){
    var p = common.plan(10,done)
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
, tls: function(done) {
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
}

