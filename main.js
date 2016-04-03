var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var config = require('./config.json')

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
  for(var j=0;j<taskamount;++j) teams[i].tasks[j] = 0;
  updateTeam(i);
}
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
    var idd = 0;
    for(var i=0;i<teams.length;++i) if(teams[i].id==id){
      idd=i;
      break;
    }
    teams[idd].tasks[t] = upd.state;
    updateTeam(idd);
    updateRanking();
    socket.emit('update_success',upd);
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
  else
    return 0;
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
