var test = require('tap').test
var JsonContext = require('../')

var mergeClone = require('../lib/merge_clone')


test('Obtain by query', function(t){
  t.plan(2)
  var item = {id: 1, type: 'item', title: "Fancy item"}
  var datasource = JsonContext({
    data: {
      items: [item]
    }
  })

  var obtainedObject = datasource.obtain('items[id=1]')
  t.deepEqual(obtainedObject, datasource.data.items[0], 'check identical to original object')
  t.notEqual(obtainedObject, datasource.data.items[0], 'check not the same referenced object')

})

test('Obtain direct', function(t){
  t.plan(3)
  var item = {id: 1, type: 'item', title: "Fancy item"}
  var datasource = JsonContext({
    data: {
      items: [item]
    },
    matchers: [
      {collection: 'items', item: 'items[id={.id}]', match: {
        type: 'item'
      }}
    ]
  })

  var obtainedObject = datasource.obtain(item)
  t.deepEqual(obtainedObject, datasource.data.items[0], 'check identical to original object')

  t.notEqual(obtainedObject, item, 'check original not the same referenced object')
  t.notEqual(obtainedObject, datasource.data.items[0], 'check not the same referenced object')

})


test('Update by query', function(t){
  t.plan(2)
  var item = {id: 1, type: 'item', title: "Fancy item"}
  var originalItem = mergeClone(item)

  var datasource = JsonContext({
    data: {
      items: [item]
    },
    matchers: [
      {collection: 'items', item: 'items[id={.id}]', match: {
        type: 'item'
      }}
    ]
  })


  var result = datasource.update('items[id=1]', {title: 'changed title'}, {verifiedChange: true})
  t.ok(result.accepted, 'change accepted')
  t.deepEqual(datasource.data.items[0], mergeClone(originalItem, {title: 'changed title'}), 'check change made')
})

test('Update by object', function(t){
  t.plan(2)
  var item = {id: 1, type: 'item', title: "Fancy item"}
  var originalItem = mergeClone(item)

  var datasource = JsonContext({
    data: {
      items: [item]
    },
    matchers: [
      {collection: 'items', item: 'items[id={.id}]', match: {
        type: 'item'
      }}
    ]
  })


  var result = datasource.update(item, {title: 'changed title'}, {verifiedChange: true})
  t.ok(result.accepted, 'change accepted')
  t.deepEqual(datasource.data.items[0], mergeClone(originalItem, {title: 'changed title'}), 'check change made')
})