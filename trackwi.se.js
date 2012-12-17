if (Meteor.isClient) {
  
  Tracks = new Meteor.Collection('tracks');
  Units = new Meteor.Collection("units");
   
  // ID of currently selected track
  Session.set('track_id', null);
  
  // Subscribe to 'tracks' collection on startup.
  // Select a track once data has arrived.
  Meteor.subscribe('tracks', function () {
    if (!Session.get('track_id')) {
      var tracks = Tracks.findOne({}, {sort: {name: 1}});
      if (tracks)
        Router.setTrack(tracks._id);
    }
  });
  
  // Always be subscribed to the units for the selected track.
Meteor.autosubscribe(function () {
  var track_id = Session.get('track_id');
  if (track_id) {
    Meteor.subscribe('units', track_id);
    
    var track = Tracks.findOne({'_id': track_id});
    if (track)
      document.title = track.name + ' | Trackwise';
  }
});
  
  // Returns an event map that handles the "escape" and "return" keys and
  // "blur" events on a text input (given by selector) and interprets them
  // as "ok" or "cancel".
  var okCancelEvents = function (selector, callbacks) {
    var ok = callbacks.ok || function () {};
    var cancel = callbacks.cancel || function () {};

    var events = {};
    events['keyup '+selector+', keydown '+selector+', focusout '+selector] =
      function (evt) {
        if (evt.type === "keydown" && evt.which === 27) {
          // escape = cancel
          cancel.call(this, evt);

        } else if (evt.type === "keyup" && evt.which === 13 ||
                   evt.type === "focusout") {
          // blur/return/enter = ok/submit if non-empty
          var value = String(evt.target.value || "");
          if (value)
            ok.call(this, value, evt);
          else
            cancel.call(this, evt);
        }
      };
    return events;
  };
  
  var activateInput = function (input) {
    input.focus();
    input.select();
  };
  
  ////////// Tracks //////////

  Template.tracks.tracks = function () {
    return Tracks.find({}, {sort: {name: 1}});
  };
  
  Template.tracks.events({
    'mousedown .track': function (evt) { // select list
      Router.setTrack(this._id);
    },
    'click .track': function (evt) {
      // prevent clicks on <a> from refreshing the page.
      evt.preventDefault();
    },
    'dblclick .track': function (evt, tmpl) { // start editing list name
      Session.set('editing_trackname', this._id);
      Meteor.flush(); // force DOM redraw, so we can focus the edit field
      activateInput(tmpl.find("#track-name-input"));
    }
  });
  
  // Attach events to keydown, keyup, and blur on "New list" input box.
  Template.tracks.events(okCancelEvents(
    '#new-track',
    {
      ok: function (text, evt) {
        var id = Tracks.insert({name: text});
        Router.setTrack(id);
        evt.target.value = "";
      }
    }));
  
  Template.tracks.events(okCancelEvents(
  '#track-name-input',
  {
    ok: function (value) {
      Tracks.update(this._id, {$set: {name: value}});
      Session.set('editing_trackname', null);
    },
    cancel: function () {
      Session.set('editing_trackname', null);
    }
  }));
  
  Template.tracks.selected = function () {
    return Session.equals('track_id', this._id) ? 'selected' : '';
  };
  
  Template.tracks.editing = function () {
    return Session.equals('editing_trackname', this._id);
  };
  
  Template.tracks.unit_count = function () {
    var f = Units.find({track_id: this._id});
    return f.count();
  }
  
  Template.track.any_track_selected = function () {
    return !Session.equals('track_id', null);
  };
    
  Template.track.unit = function () {
    // Determine which track to display in main pane,
    // selected based on track_id.

    var track_id = Session.get('track_id');
    if (!track_id)
      return {};
//      
//    var track = Tracks.findOne({'_id': track_id});
//    if (track)
//      document.title = track.name + ' | Trackwise';

    var sel = {track_id: track_id};
    return Units.find(sel, {sort: {timestamp: 1}});
  };
  
  Template.track.events(okCancelEvents(
  '#new-unit',
  {
    ok: function (text, evt) {
      Units.insert({
        name: text,
        track_id: Session.get('track_id'),
        timestamp: (new Date()).getTime()
      });
      evt.target.value = '';
    }
  }));
  
  // Add URL routing through Backbone

  var TrackRouter = Backbone.Router.extend({
    routes: {
      "track/:name/:track": "main"
    },
    main: function(name, track_id) {
      Session.set("track_id", track_id);
    },
    setTrack: function (track_id) {
      var track = Tracks.findOne({'_id': track_id});
      var name = track.name.replace(/\s/g, '-', track.name).toLowerCase();
      this.navigate('track/' + name + '/' + track_id, true);
    }
  });

  Router = new TrackRouter;
  
  Meteor.startup(function () {
    Backbone.history.start({pushState: true});
  });
}

if (Meteor.isServer) {
  // Tracks -- {name: String}
  Tracks = new Meteor.Collection("tracks");
  Units = new Meteor.Collection("units");
  
  Meteor.startup(function () {
    // code to run on server at startup
    
    // Add initial data to app
    if (Tracks.find().count() === 0) {
      var data = [
        {name: "My Sleepover"},
        {name: "Athletics", 
         units: [
           {name: "F15"},
           {name: "P15"},
           {name: "F17"},
           {name: "P17"}
        ]},
        {name: "Orienteering"}
      ];
      
      var timestamp = (new Date()).getTime();
      for (var i = 0; i < data.length; i++) {
        var track_id = Tracks.insert({name: data[i].name});
        if (data[i].units) {
          for (var j = 0; j < data[i].units.length; j++) {
            var unit = data[i].units[j];
            Units.insert({track_id: track_id,
                          name: unit.name,
                          timestamp: timestamp});
            timestamp += 1; // ensure unique timestamp.          
          }
        }
      }
    }
    
  });

  // Publish complete set of tracks to all clients.
  Meteor.publish('tracks', function () {
    return Tracks.find();
  });
  
  // Publish complete set of tracks to all clients.
  Meteor.publish('units', function () {
    return Units.find();
  });
}
