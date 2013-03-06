var test = require('tap').test
var JsonContext = require('../')

var mergeClone = require('../lib/merge_clone')


test('Single item key match', function(t){
  t.plan(1)
  var datasource = JsonContext({matchers: [
    {item: 'test', match: {
      id: '1234',
      type: 'page'
    }}
  ]})
  var newObject = {id: '1234', type: 'page', title: "Fancy Page"}
  datasource.pushChange(newObject, {verifiedChange: true})
  t.deepEqual(datasource.data, {test: newObject})

})



test('Append collection match', function(t){
  t.plan(1)
  var datasource = JsonContext({matchers: [
    {collection: 'pages', item: 'pages[id={.id}]', match: {
      type: 'page'
    }}
  ]})
  var newObject1 = {id: 1, type: 'page', title: "Fancy Page"}
  var newObject2 = {id: 2, type: 'page', title: "Another Fancy Page"}
  var failObject = {id: 3, type: 'evil_page', title: "A dark and evil page"}

  datasource.pushChange(newObject1, {verifiedChange: true})
  datasource.pushChange(newObject2, {verifiedChange: true})
  datasource.pushChange(failObject, {verifiedChange: true})

  t.deepEqual(datasource.data, {pages: [newObject1, newObject2]})

})



test('Append collection with lookup key match', function(t){
  t.plan(1)
  var datasource = JsonContext({matchers: [
    {collection: 'pages', collectionKey: '.id', item: 'pages[{.id}]', match: {
      type: 'page'
    }}
  ]})
  var newObject1 = {id: 'some-id-1', type: 'page', title: "Fancy Page"}
  var newObject2 = {id: 'some-id-2', type: 'page', title: "Another Fancy Page"}

  datasource.pushChange(newObject1, {verifiedChange: true})
  datasource.pushChange(newObject2, {verifiedChange: true})

  t.deepEqual(datasource.data, {pages: {
    'some-id-1': newObject1,
    'some-id-2': newObject2
  }})

})


test('Update existing object', function(t){
  t.plan(5)

  var testMetaData = 'Test meta data'
  var existingObject1 = {id: 1, type: 'page', title: "Fancy Page"}
  var existingObject2 = {id: 2, type: 'page', title: "Another Fancy Page", $meta: testMetaData}

  var datasource = JsonContext({
    matchers: [
      {collection: 'pages', item: 'pages[id={.id}]', match: {
        type: 'page'
      }}
    ],
    data: { pages: [existingObject1, existingObject2] }
  })

  var copyObject = mergeClone(existingObject1)
  var changedObject = datasource.obtain(existingObject2)
  changedObject.title = "A new title"

  t.notEqual(changedObject, existingObject2, "check object cloned")
  t.notEqual(changedObject.$meta, existingObject2.$meta, "check meta removed")

  datasource.pushChange(changedObject, {verifiedChange: true})

  t.deepEqual(datasource.data, {pages: [copyObject, mergeClone(changedObject, {$meta: testMetaData})]})
  t.equal(existingObject2, datasource.data.pages[1], "check in place update")
  t.equal(existingObject2.$meta, testMetaData, "check meta data preserved")

})

test('Update existing object with collection key', function(t){
  t.plan(5)

  var testMetaData = 'Test meta data'
  var existingObject1 = {id: 1, type: 'page', title: "Fancy Page"}
  var existingObject2 = {id: 2, type: 'page', title: "Another Fancy Page", $meta: testMetaData}

  var datasource = JsonContext({
    matchers: [
      {collection: 'pages', item: 'pages[id={.id}]', match: {
        type: 'page'
      }}
    ],
    data: { pages: [existingObject1, existingObject2] }
  })

  var copyObject = mergeClone(existingObject1)
  var changedObject = datasource.obtain(existingObject2)
  changedObject.title = "A new title"

  t.notEqual(changedObject, existingObject2, "check object cloned")
  t.notEqual(changedObject.$meta, existingObject2.$meta, "check meta removed")

  datasource.pushChange(changedObject, {verifiedChange: true})

  t.deepEqual(datasource.data, {pages: [copyObject, mergeClone(changedObject, {$meta: testMetaData})]})
  t.equal(existingObject2, datasource.data.pages[1], "check in place update")
  t.equal(existingObject2.$meta, testMetaData, "check meta data preserved")

})

test('Update single item key object', function(t){
  t.plan(5)

  var testMetaData = 'Test meta data'
  var existingObject = {id: 2, type: 'page', title: "Another Fancy Page", $meta: testMetaData}

  var datasource = JsonContext({
    matchers: [
      {item: 'page', match: {
        type: 'page', id: 2
      }}
    ],
    data: { page: existingObject }
  })

  var changedObject = datasource.obtain(existingObject)
  changedObject.title = "A new title"

  t.notEqual(changedObject, existingObject, "check object cloned")
  t.notEqual(changedObject.$meta, existingObject.$meta, "check meta removed")

  datasource.pushChange(changedObject, {verifiedChange: true})

  t.deepEqual(datasource.data, {page: mergeClone(changedObject, {$meta: testMetaData})})
  t.equal(existingObject, datasource.data.page, "check in place update")
  t.equal(existingObject.$meta, testMetaData, "check meta data preserved")

})

test('Update collection with lookup key match', function(t){
  t.plan(5)

  var testMetaData = 'Test meta data'
  var existingObject1 = {id: 'some-id-1', type: 'page', title: "Fancy Page"}
  var existingObject2 = {id: 'some-id-2', type: 'page', title: "Another Fancy Page", $meta: testMetaData}

  var datasource = JsonContext({
    matchers: [
      {collection: 'pages', collectionKey: '.id', item: 'pages[{.id}]', match: {
        type: 'page'
      }}
    ],     
    data: { pages: {
      'some-id-1': existingObject1,
      'some-id-2': existingObject2
    }}
  })


  var copyObject = mergeClone(existingObject1)
  var changedObject = datasource.obtain(existingObject2)
  changedObject.title = "A new title"

  t.notEqual(changedObject, existingObject2, "check object cloned")
  t.notEqual(changedObject.$meta, existingObject2.$meta, "check meta removed")

  datasource.pushChange(changedObject, {verifiedChange: true})

  t.deepEqual(datasource.data, {pages: {
    'some-id-1': copyObject,
    'some-id-2': mergeClone(changedObject, {$meta: testMetaData})
  }})

  t.equal(existingObject2, datasource.data.pages['some-id-2'], "check in place update")
  t.equal(existingObject2.$meta, testMetaData, "check meta data preserved")

})

test('Remove item from collection', function(t){
  t.plan(1)
  var existingObject1 = {id: 1, type: 'page', title: "Fancy Page"}
  var existingObject2 = {id: 2, type: 'page', title: "Another Fancy Page"}

  var datasource = JsonContext({
    matchers: [
      {collection: 'pages', item: 'pages[id={.id}]', match: {
        type: 'page'
      }}
    ],
    data: { pages: [existingObject1, existingObject2] }
  })

  var changedObject = datasource.obtain(existingObject2)
  changedObject._deleted = true
  datasource.pushChange(changedObject, {verifiedChange: true})

  t.deepEqual(datasource.data, {pages: [existingObject1]})

})

test('Remove item from root', function(t){
  t.plan(1)
  var existingObject = {id: 2, type: 'page', title: "Another Fancy Page"}
  var otherData = [1,2,3,4]
  var datasource = JsonContext({
    matchers: [
      {item: 'page', match: {
        type: 'page', id: 2
      }}
    ],
    data: { page: existingObject, otherData: otherData }
  })

  var changedObject = datasource.obtain(existingObject)
  changedObject._deleted = true
  datasource.pushChange(changedObject, {verifiedChange: true})

  t.deepEqual(datasource.data, {otherData: otherData})
})



