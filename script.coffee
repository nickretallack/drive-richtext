clientId = '661099579330-dctm6hcm5co8jt8ug7qreu1kfn1t9ru3.apps.googleusercontent.com'
realtimeUtils = new utils.RealtimeUtils
  clientId: clientId

quill = new Quill '#editor'

authorize = ->
  # Attempt to authorize
  realtimeUtils.authorize ((response) ->
    if response.error
      # Authorization failed because this is the first time the user has used your application,
      # show the authorize button to prompt them to authorize manually.
      button = document.getElementById('auth_button')
      button.classList.add 'visible'
      button.addEventListener 'click', ->
        realtimeUtils.authorize ((response) ->
          start()
          return
        ), true
        return
    else
      start()
    return
  ), false
  return

start = ->
  # With auth taken care of, load a file, or create one if there
  # is not an id in the URL.
  id = realtimeUtils.getParam('id')
  if id
    # Load the document id from the URL
    realtimeUtils.load id.replace('/', ''), onFileLoaded
  else
    # Create a new document, add it to the URL
    realtimeUtils.createRealtimeFile 'New Quickstart File', (createResponse) ->
      window.history.pushState null, null, '?id=' + createResponse.id
      realtimeUtils.load createResponse.id, onFileLoaded
      return
  return

get_attributes_at_index = (index) ->
  if index == 0
    return null
  quill.getContents(index - 1, index).ops[0].attributes

apply_format = (item, value) ->
  console.log 'APPLY FORMAT', item.get('start').index, item.get('end').index, item.get('attribute'), value
  quill.formatText item.get('start').index, item.get('end').index, item.get('attribute'), value
  return

insert_text = (index, text) ->
  attributes = get_attributes_at_index(index)
  quill.insertText index, text, attributes
  return

delete_text = (index, text) ->
  quill.deleteText index, index + text.length
  return

# After a file has been initialized and loaded, we can access the
# document. We will wire up the data model to the UI.

printExceptions = (fun) ->
  ->
    try
      fun arguments...
    catch error
      console.log error

onFileLoaded = printExceptions (doc) ->
  # Overlay preview

  preview_overlay = (item) ->
    node = render_overlay(item)
    $('#overlays tbody').append node
    item.get('start').addEventListener gapi.drive.realtime.EventType.REFERENCE_SHIFTED, (event) ->
      node.find('.start').text event.newIndex
      return
    item.get('end').addEventListener gapi.drive.realtime.EventType.REFERENCE_SHIFTED, (event) ->
      node.find('.end').text event.newIndex
      return
    return

  render_overlay = (item) ->
    console.log 'previewing ', item.get('id')
    $ '<tr id="overlay-' + item.get('id') + '">' + '<td class="attribute">' + item.get('attribute') + '</td>' + '<td class="start">' + item.get('start').index + '</td>' + '<td class="end">' + item.get('end').index + '</td>' + '<td class="id">' + item.get('id') + '</td>' + '</tr>'

  remove_overlay_preview = (item) ->
    console.log 'unpreviewing ', item.get('id')
    $('#overlays tbody #overlay-' + item.get('id')).remove()
    return

  find_attribute_changes = (old_attributes, new_attributes) ->
    `var attribute`
    attributes = {}
    # find added attributes
    for attribute of new_attributes
      if !(old_attributes and attribute of old_attributes)
        attributes[attribute] = new_attributes[attribute]
    # find removed attributes
    for attribute of old_attributes
      if !(new_attributes and attribute of new_attributes)
        attributes[attribute] = null
    attributes

  console.log 'LOADED'
  model = doc.getModel()
  root = model.getRoot()
  richtext = new CollaborativeRichText
    model: model
    parent: root
    name: 'richtext'
    handlers: {insert_text, delete_text, apply_format, preview_overlay, remove_overlay_preview}

  quill.on 'text-change', (delta, source) ->
    if source == 'user'
      text_index = 0
      new_text_index = null
      for operation_index of delta.ops
        operation = delta.ops[operation_index]
        # formatting added via the toolbar
        if operation.retain
          richtext.formatText text_index, operation.retain, operation.attributes
          text_index += operation.retain
        if operation.insert
          console.log 'insert...', operation.insert
          attributes = find_attribute_changes(get_attributes_at_index(text_index), operation.attributes)
          richtext.insertText text_index, operation.insert, attributes
          text_index += operation.insert.length
        if operation.delete
          console.log 'delete...', operation.delete
          richtext.deleteText text_index, operation.delete
          text_index += operation.delete
    return
  return

quill.addModule 'toolbar', container: '#toolbar'
authorize()
