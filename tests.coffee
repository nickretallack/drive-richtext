run_tests = ->
  doc = gapi.drive.realtime.newInMemoryDocument()
  model = doc.getModel()
  parent = model.getRoot()
  name = 'test'
  richtext = null

  QUnit.module 'tests',
    beforeEach: (assert) ->
      parent.clear()

  QUnit.test 'extend forward', (assert) ->
    richtext = new CollaborativeRichText {model, parent, name}
    richtext.insertText 0, "123456789"
    richtext.formatText 0, 3, {bold:true}

    assert.deepEqual richtext.debug_overlays(),
      bold: [{start:0, end:3}]

    richtext.formatText 3, 1, {bold:true}
    assert.deepEqual richtext.debug_overlays(),
      bold: [{start:0, end:4}]

    return

  QUnit.test 'extend backward', (assert) ->
    richtext = new CollaborativeRichText {model, parent, name}
    richtext.insertText 0, "123456789"
    richtext.formatText 5, 2, {bold:true}

    assert.deepEqual richtext.debug_overlays(),
      bold: [{start:5, end:7}]

    richtext.formatText 3, 2, {bold:true}
    assert.deepEqual richtext.debug_overlays(),
      bold: [{start:3, end:7}]

    return

  return

window.gapi.load 'auth:client,drive-realtime,drive-share', run_tests