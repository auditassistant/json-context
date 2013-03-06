var test = require('tap').test
var JsonContext = require('../')

var mergeClone = require('../lib/merge_clone')


test('Changes emitted from change stream', function(t){
  t.plan(1)
  var datasource = JsonContext({matchers: [
    {collection: 'pages', item: 'pages[id={.id}]', match: {
      type: 'page'
    }}
  ]})

  var newObject = {id: 1, type: 'page', title: "Fancy Page"}

  var stream = datasource.changeStream()
  stream.once('data', function(text){
    t.deepEqual(JSON.parse(text).object, newObject, 'Emitted object matches')
  })

  datasource.pushChange(newObject, {verifiedChange: true})
})



test('No change stream feedback', function(t){
  t.plan(3)
  var datasource = JsonContext({matchers: [
    {collection: 'pages', item: 'pages[id={.id}]', match: {
      type: 'page'
    }}
  ]})

  var newObject1 = {id: 1, type: 'page', title: "Fancy Page"}
  var newObject2 = {id: 2, type: 'page', title: "Another Fancy Page"}


  var stream1 = datasource.changeStream({verifiedChange: true})
  var stream2 = datasource.changeStream({verifiedChange: true})

  stream1.once('data', function(text){
    t.deepEqual(JSON.parse(text).object, newObject2, 'object2 from stream1')
  })

  stream2.once('data', function(text){
    t.deepEqual(JSON.parse(text).object, newObject1, 'object1 from stream2')
  })

  stream1.write(JSON.stringify({object: newObject1}) + '\n')
  stream2.write(JSON.stringify({object: newObject2}) + '\n')

  t.deepEqual(datasource.data, {pages: [newObject1, newObject2]})
})