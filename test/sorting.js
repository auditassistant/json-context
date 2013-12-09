var test = require('tap').test

var JsonContext = require('../')

var data = {
  
  links: [
    { _id: 'link3',
      type: 'link',
      title: "Github",
      url: 'https://github.com/mmckegg',
      _before: 'link4'
    },
    { _id: 'link4',
      type: 'link',
      title: "Twitter",
      url: 'https://twitter.com/MattMckegg',
      _before: 'link1'
    },
    { _id: 'link1',
      type: 'link',
      title: "Node.js Website",
      url: 'http://nodejs.org'
    },
    { _id: 'link2',
      type: 'link',
      title: "NPM Website",
      url: 'http://npmjs.org'
    }
  ],
  
  moreLinks: [
    { _id: 'link3',
      type: 'otherLink',
      title: "Github",
      url: 'https://github.com/mmckegg'
    },
    { _id: 'link4',
      type: 'otherLink',
      title: "Twitter",
      url: 'https://twitter.com/MattMckegg',
      _after: 'link3'
    },
    { _id: 'link1',
      type: 'otherLink',
      title: "Node.js Website",
      url: 'http://nodejs.org'
    },
    { _id: 'link2',
      type: 'otherLink',
      title: "NPM Website",
      url: 'http://npmjs.org'
    }
  ],
  
}

var matchers = [
  {
    item: 'links[_id={._id}]',
    collection: 'links',
    sort: {type: 'before', key: '_before', compareKey: '_id'}, // key[0]: target property // key[1]: collection identifing property
    match: {
      type: 'link'
    }
  },
  {
    item: 'moreLinks[_id={._id}]',
    collection: 'moreLinks',
    sort: {type: 'after', key: '_after', compareKey: '_id'}, // key[0]: target property // key[1]: collection identifing property
    match: {
      type: 'otherLink'
    }
  }
]

function runTests(){

  test("Before sorting - move link3 to before link2", function(t){
    freshData(function(data, context){
      
      var originalOrder = ['link3','link4','link1','link2']
      var expectedOrder = ['link4','link1','link3','link2']
      t.deepEqual(data.links.map(function(l){return l._id}), originalOrder, "Original match")
      
      var link = data.links[0]
      
      var linkQuery = context.query('links[_id=link3]')
      var originalIndex = linkQuery.key
      
      
      var changedLink = context.obtain('links[_id=link3]')
      changedLink._before = 'link2'
      
      context.on('change', function(object, changeInfo){
        if (object === link){
          t.equal(changeInfo.before, data.links[3], 'Before changeInfo set on change event')
        }
      })
      context.pushChange(changedLink, {verifiedChange: true})   
      
      var newOrder = data.links.map(function(l){return l._id})
      
      t.deepEqual(newOrder, expectedOrder)
      
      t.equal(data.links[2], link, 'Item moved by before-sort to position 2')
      t.end()
    })
  })
  
  test("Before sorting move link3 to end", function(t){
    freshData(function(data, context){
    
      var originalOrder = ['link3','link4','link1','link2']
      var expectedOrder = ['link4','link1','link2','link3']
      
      var changedLink = context.obtain('links[_id=link3]')
      changedLink._before = -1
      context.pushChange(changedLink, {verifiedChange: true})   
      
      var newOrder = data.links.map(function(l){return l._id})
      t.deepEqual(newOrder, expectedOrder)
      
      t.end()
    })
  })
  
  test("After sorting - move link3 to after link1", function(t){
    freshData(function(data, context){
      
      var originalOrder = ['link3','link4','link1','link2']
      var expectedOrder = ['link4','link1','link3','link2']
      
      t.deepEqual(data.moreLinks.map(function(l){return l._id}), originalOrder, "Original match")
                  
      var changedLink = context.obtain('moreLinks[_id=link3]')
      changedLink._after = 'link1'
      
      context.pushChange(changedLink, {verifiedChange: true})   
      
      var newOrder = data.moreLinks.map(function(l){return l._id})
      
      t.deepEqual(newOrder, expectedOrder)
      
      t.end()
    })
  })
  
  test("After sorting move link1 to beginning", function(t){
    freshData(function(data, context){
    
      var originalOrder = ['link3','link4','link1','link2']
      var expectedOrder = ['link1','link3','link4','link2']
      
      var changedLink = context.obtain('moreLinks[_id=link1]')
      changedLink._after = -1
      context.pushChange(changedLink, {verifiedChange: true})   
      
      var newOrder = data.moreLinks.map(function(l){return l._id})
      t.deepEqual(newOrder, expectedOrder)
      
      t.end()
    })
  })

  test('force start position', function(t){
    freshData(function(data, context){
      var originalOrder = ['link3','link4','link1','link2']
      var expectedOrder = ['link1','link3','link4','link2']

      var changedLink = context.obtain('moreLinks[_id=link1]')
      context.pushChange(changedLink, {verifiedChange: true, after: 'start'})  

      var newOrder = data.moreLinks.map(function(l){return l._id})
      t.deepEqual(newOrder, expectedOrder)
      
      t.end()
    })
  })

  test('force after position', function(t){
    freshData(function(data, context){
      var originalOrder = ['link3','link4','link1','link2']
      var expectedOrder = ['link4','link1','link2', 'link3']

      var lastLink = context.get('moreLinks[_id=link2]')
      var changedLink = context.obtain('moreLinks[_id=link3]')
      context.pushChange(changedLink, {verifiedChange: true, after: lastLink})  

      var newOrder = data.moreLinks.map(function(l){return l._id})
      t.deepEqual(newOrder, expectedOrder)
      
      t.end()
    })
  })

}

var jsonData = JSON.stringify(data)
function freshData(func){
  var data = JSON.parse(jsonData)
  var context = JsonContext({matchers: matchers, data: data})
  func(data, context)
}

function p(text){
  console.info(text)
}

runTests()