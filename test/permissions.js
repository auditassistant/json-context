var test = require('tap').test
var JsonContext = require('../')
var mergeClone = require('../lib/merge_clone')



test('Only update to one root allowed', function(t){
  t.plan(1)

  var page1 = {id: 1, type: 'page', title: "Fancy Page"}
  var page2 = {id: 2, type: 'page', title: "Another Fancy Page"}

  var project = {id: 125, type: 'project', title: "Project Meow"}

  var datasource = JsonContext({
    matchers: [
      {collection: 'pages', item: 'pages[id={.id}]', match: {
        type: 'page'
      }},
      { item: 'project', 
        match: {
          type: 'project',
          id: 125
        }, 
        allow: {
          update: true
        }
      }
    ],
    data: {pages: [page1, page2], project: project}
  })

  var copyPage1 = mergeClone(page1)
  var copyPage2 = mergeClone(page2)

  // should be accepted
  var changedProject = datasource.obtain(project)
  changedProject.title = "Project Woof"
  datasource.pushChange(changedProject)

  // should not be accepted
  var changedPage = datasource.obtain(page1)
  changedPage.title = "Meow meow meow"
  datasource.pushChange(changedPage)

  t.deepEqual(datasource.data, {pages: [copyPage1, copyPage2], project: changedProject})
})

test('Only update to one root allowed by filter', function(t){
  t.plan(2)

  var project = {id: 125, type: 'project', title: "Project Meow"}

  var datasource = JsonContext({
    matchers: [
      { item: 'project', 
        match: {
          type: 'project',
          id: 125
        }, 
        allow: {
          change: ':checkAllowed'
        }
      }
    ],
    data: {project: project},
    dataFilters: {
      checkAllowed: function(input, params){
        var allowedChanges = ['title']
        return Object.keys(input.changes).every(function(key){
          return ~allowedChanges.indexOf(key)
        })
      }
    }
  })

  // should be accepted
  var changedProject1 = datasource.obtain(project)
  changedProject1.title = "Project Woof"
  datasource.pushChange(changedProject1)

  t.deepEqual(datasource.data, {project: changedProject1}, 'check accepted first change')

  // should not be accepted
  var changedProject2 = datasource.obtain(project)
  changedProject2.hackerFieldTrololol = 'HAXXX'
  datasource.pushChange(changedProject2)

  t.notDeepEqual(datasource.data, {project: changedProject2}, "check didn't accepted second")
})