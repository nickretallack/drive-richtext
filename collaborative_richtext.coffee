
class CollaborativeRichText
  constructor: ({@model, parent, name, handlers}) ->
    @setup_model parent, name
    @setup_events handlers
    @run_initial_events handlers

  setup_model: (parent, name) ->
    @obj = @get_or_create_field @model.createMap, parent, name
    @str = @get_or_create_field @model.createString, @obj, 'text'
    @overlays = @get_or_create_field @model.createList, @obj, 'overlays'

    @auto_incrementer = if @overlays.length
      @overlays.get(@overlays.length-1).get('id')
    else 0

  get_or_create_field: (constructor, parent, name) ->
    # progressively extend it in case they have an incompatible model and we're adding new features
    result = parent.get name
    unless result
      result = constructor.call @model
      parent.set name, result
    return result

  setup_events: (handlers) ->
    @overlays.addEventListener gapi.drive.realtime.EventType.VALUES_ADDED, (event) ->
      if handlers.preview_overlay
        event.values.forEach handlers.preview_overlay
      if handlers.apply_format and not event.isLocal
        event.values.forEach (item) ->
          handlers.apply_format item, true
      return

    @overlays.addEventListener gapi.drive.realtime.EventType.VALUES_REMOVED, (event) ->
      if handlers.remove_overlay_preview
        event.values.forEach handlers.remove_overlay_preview
      if handlers.apply_format and not event.isLocal
        event.values.forEach (item) ->
          handlers.apply_format item, false
      return

    @str.addEventListener gapi.drive.realtime.EventType.TEXT_INSERTED, (event) ->
      if not event.isLocal
        console.log 'INSERTED', event.index, event.text
        handlers.insert_text? event.index, event.text
      return

    @str.addEventListener gapi.drive.realtime.EventType.TEXT_DELETED, (event) ->
      if not event.isLocal
        console.log 'DELETED', event.index, event.text
        handlers.delete_text? event.index, event.text
      return

  run_initial_events: (handlers) ->
    handlers.insert_text? 0, @str.getText()
    if handlers.preview_overlay
      @overlays.asArray().forEach handlers.preview_overlay
    if handlers.apply_format
      @overlays.asArray().forEach (item) => handlers.apply_format item, true

  # Overlays

  create_overlay: (start_index, end_index, attribute) ->
    console.log 'create overlay:', start_index, end_index, attribute
    start_ref = @str.registerReference start_index, gapi.drive.realtime.IndexReference.DeleteMode.SHIFT_BEFORE_DELETE
    end_ref = @str.registerReference end_index, gapi.drive.realtime.IndexReference.DeleteMode.SHIFT_BEFORE_DELETE
    @overlays.push @model.createMap
      start: start_ref
      end: end_ref
      attribute: attribute
      id: @auto_incrementer++
    return

  remove_overlay: (overlay) ->
    console.log 'remove overlay', overlay.get('start').index, overlay.get('end').index, overlay.get('attribute')
    @overlays.removeValue overlay
    return

  find_colliding_overlay: (attribute, index) ->
    for overlay in @overlays.asArray
      if attribute == overlay.get('attribute') and overlay.get('start').index <= index and overlay.get('end').index >= index
        return overlay

  delete_overlay_range: (start_index, end_index) ->
    deletable_overlays = @overlays.asArray().filter (overlay) ->
      overlay_start = overlay.get('start').index
      overlay_end = overlay.get('end').index
      overlay_start >= start_index and overlay_end <= end_index
    for overlay in deletable_overlays
      @remove_overlay overlay
    return

  split_or_remove_overlay: (start_index, end_index, attribute) ->
    overlay = @find_colliding_overlay attribute, start_index
    if !overlay
      console.log 'ANOMALY - deleted overlay that wasn\'t found'
      return
    overlay_start = overlay.get('start')
    overlay_end = overlay.get('end')
    matches_start = start_index == overlay_start.index
    matches_end = end_index == overlay_end.index

    remove_overlay overlay
    if matches_start and matches_end
      # remove the whole overlay
      console.log 'remove whole overlay', attribute
    else if matches_start
      # erase the start of this overlay
      console.log 'remove beginning of overlay', attribute
      @create_overlay end_index, overlay_end.index, attribute
    else if matches_end
      # erase the end of this overlay
      console.log 'remove end of overlay', attribute
      @create_overlay overlay_start.index, start_index, attribute
    else
      # split this overlay into two
      console.log 'split overlay', attribute
      @create_overlay overlay_start.index, start_index, attribute # first half
      @create_overlay end_index, overlay_end.index, attribute # second half
    return

  extend_or_create_overlay: (start_index, end_index, attribute) ->
    found_start = @find_colliding_overlay attribute, start_index - 1
    found_end = @find_colliding_overlay attribute, end_index
    if found_start and found_end
      console.log 'connect two overlays', attribute
      @remove_overlay found_start
      @remove_overlay found_end
      @create_overlay found_start.get('start').index, found_end.get('end').index, attribute
    else if found_start
      console.log 'extend overlay forward', attribute
      @remove_overlay found_start
      @create_overlay found_start.get('start').index, end_index, attribute
    else if found_end
      console.log 'extend overlay backward', attribute
      @remove_overlay found_end
      @create_overlay start_index, found_end.get('end').index, attribute
    else
      console.log 'create new overlay', attribute
      @create_overlay start_index, end_index, attribute
    return

  # Public API

  formatText: (index, length, attributes) ->
    end_index = index + length
    for attribute, value of attributes
      if value
        @extend_or_create_overlay index, end_index, attribute
      else
        @split_or_remove_overlay index, end_index, attribute
    return

  insertText: (index, text, attributes) ->
    @str.insertString index, text
    @formatText index, index + text.length, attributes
    return

  deleteText: (index, length) ->
    end_index = index + length
    @delete_overlay_range index, end_index
    @str.removeRange index, end_index
    return

window.CollaborativeRichText = CollaborativeRichText