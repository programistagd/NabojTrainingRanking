var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var config = require('./config.json')
var Db = require('tingodb')().Db;

var db = new Db('./database.db', {});
var backup = db.collection('results', function(err, collection) {
  if(err){
    console.log(err);
    console.log("Database may not work. Be warned that you may not have a backup in case of crash!");
  }
  else{
    var amnt = 0;
    backup.find().each(function(err,doc) {
      if(!doc){
        updateRanking();
        console.log("Loaded "+amnt+" teams from backup");
        return;
      }
      if(err){
        //console.log("Error loading backup!");
        console.log(err);
        return;
      }
      var id = doc.id;
      //console.log(doc);
      if(id<0 || id>=teams.length || doc.tasks.length != taskamount){
        console.log("Incompatible update data ",doc);
        return;
      }
      var idd=id;
      if(teams[idd].id!=id){
          for(var i=0;i<teams.length;++i){
            if(teams[i].id==id){
              idd=i;
              break;
            }
          }
      }
      if(teams[idd].id!=id){
        console.log("Error: this shouldn't happen");
        return;
      }
      teams[idd].tasks = doc.tasks;
      teams[idd].lastUpdated = doc.lastUpdated;
      updateTeam(idd);
      amnt++;
      console.log("Loaded "+teams[idd].name+"("+teams[idd].id+"/"+doc.id+")");
    });
  }
});

var taskamount = config.taskAmount;
var duration = config.duration;
var startTime = (new Date(config.startDate)).getTime();
var teams = [];
for(var i=0;i<config.teams.length;++i){
  teams[i] = {name:config.teams[i]};
}
for(var i=0;i<teams.length;++i){
  teams[i].id = i;
  teams[i].place = 1;
  teams[i].score = 0;
  teams[i].tasks = [];
  teams[i].movement = 0;
  teams[i].lastUpdated = (new Date());
  for(var j=0;j<taskamount;++j) teams[i].tasks[j] = 0;
  updateTeam(i);
}
updateRanking();
function formatTime(time){
  var hours = Math.floor(time/3600);
  var minutes = Math.floor(time/60)%60;
  var seconds = Math.floor(time)%60;
  if(minutes<10) minutes = "0"+minutes;
  if(seconds<10) seconds = "0"+seconds;
  return hours+':'+minutes+':'+seconds;
}
(function(){
  console.log("Loaded "+teams.length+" teams:");
  for(var i=0;i<teams.length;++i) console.log(teams[i].name);
  console.log("---");
  console.log("Contest starts at "+config.startDate);
  var currentTime = (new Date()).getTime();
  if(currentTime<startTime){
    console.log("Starts in "+formatTime((startTime-currentTime)/1000))
  }else{
    console.log("Contest started "+formatTime((currentTime-startTime)/1000)+" ago")
  }
  console.log("Contest duration: "+formatTime(duration));
  console.log("Registered "+taskamount+" tasks");
})();

app.use(express.static('public'));

io.on('connection', function(socket){
  console.log('a user connected');
  socket.emit('init',{teams:teams, duration:duration, startTime:startTime});
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  socket.on('update',function(upd){
    //console.log(upd);
    var id = upd.id;
    if(id<0 || id>=teams.length){
      socket.emit('update_error',"i"+id);
      return;
    }
    var t = upd.task-1;
    if(t<0 || t>=taskamount){
      socket.emit('update_error',"t"+t);
      return;
    }
    var idd = id;
    for(var i=0;i<teams.length;++i) if(teams[i].id==id){
      idd=i;
      break;
    }
    teams[idd].tasks[t] = upd.state;
    if(upd.state>0){
      teams[idd].lastUpdated = new Date();
    }
    updateTeam(idd);
    //save to backup
    var bak = {id:teams[idd].id,tasks:teams[idd].tasks,lastUpdated:teams[idd].lastUpdated};
    backup.update({id:teams[idd].id},bak,{upsert:true},function(err){
      if(err){
        console.log("ERROR saving updated tasks to backup")
      }else{
        console.log("Saved "+teams[idd].name+"("+teams[idd].id+"/"+bak.id+")");
      }
      updateRanking();
      socket.emit('update_success',upd);
    });
  });
});
function updateTeam(id){
  var sc=0;
  var doing=0;
  for(var i=0;i<taskamount;++i){
    if(teams[id].tasks[i]==2){
      sc++;
    }
    else{
      if(doing<6){
        teams[id].tasks[i]=1;
        doing++;
      }
      else{
        teams[id].tasks[i]=0;
      }
    }
  }
  teams[id].score=sc;
  //console.log(teams[id].tasks);
}
function compare(a,b) {
  if (a.score < b.score)
    return 1;
  else if (a.score > b.score)
    return -1;
  else{
    if(a.lastUpdated < b.lastUpdated){
      return -1;
    }
    else if(a.lastUpdated > b.lastUpdated){
      return 1;
    }
    else {
        return 0;
    }
  }
}
function updateRanking(){
  for(var i=0;i<teams.length;++i){
    teams[i].oldplace = i;
  }
  teams.sort(compare);
  teams[0].place = 1;
  for(var i=1;i<teams.length;++i){
    if(teams[i].score==teams[i-1].score) teams[i].place = teams[i-1].place;
    else teams[i].place = teams[i-1].place+1;
  }
  for(var i=0;i<teams.length;++i){
    var dp = i - teams[i].oldplace;
    if(dp>0) dp=1;
    if(dp<0) dp=-1;
    teams[i].movement = dp;
  }
  io.emit('update_ranking',teams);
}

http.listen(3000, function(){
  console.log('listening on *:3000');
});
