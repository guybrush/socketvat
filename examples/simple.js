var sv = require('../socketvat')
var assert = require('assert')
// server
var s = sv()
s.set('foo','server')
s.listen(3000,function(remote,socket){
  remote.once('get',function(k,v){
    assert.equal(k,'foo')
    assert.equal(v,'client')
  })
  remote.get('foo')
})
// client
var c = sv()
c.set('foo','client')
c.connect(3000,function(remote,socket){
  remote.once('get',function(k,v){
    assert.equal(k,'foo')
    assert.equal(v,'server')
  })
  remote.get('foo')
})