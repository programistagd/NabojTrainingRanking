var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
//TODO load config!
var taskamount = 50;
var duration = 2*60*60;
var startTime = (new Date()).getTime()+10*60*1000;
var teams = [{name:"FC Barcelona"},{name:"Real Madryt"},{name:"Chicago Bulls"}];
for(var i=0;i<teams.length;++i){
  teams[i].id = i;
  teams[i].place = 1;
  teams[i].score = 0;
  teams[i].tasks = [];
  for(var j=0;j<taskamount;++j) teams[i].tasks[j] = 0;
  updateTeam(i);
}

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
  teams.sort(compare);
  teams[0].place = 1;
  for(var i=1;i<teams.length;++i){
    if(teams[i].score==teams[i-1].score) teams[i].place = teams[i-1].place;
    else teams[i].place = teams[i-1].place+1;
  }
  io.emit('update_ranking',teams);
}

http.listen(3000, function(){
  console.log('listening on *:3000');
});
