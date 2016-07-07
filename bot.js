var bot = require("DiscordBot");
var https = require('https');
var youtubeDL = require('youtube-dl');
var fs = require('fs');
var path = require("path");
var spawn = require("child_process").spawn;
var musicStatus = "off";
var nowPlaying = {};
var queue = [];
var player;
var sendAudio;
var songDuration;
var songStartTime;
var songTimer;
var skipVotes = [];
var shuffle = false;

bot.connect("MTY5NjE3MzE2ODY5NDM5NDg4.CfGPaw.B15aJ15rlSKmKrbL2cncLycKhzc");

bot.events.on('ready', function () {
  bot.updateStatus(null, "with your mom");
});

bot.chat.registerCommand("-parrot", function (args, channel, rawArgs) {
  bot.chat.sendMessage(rawArgs, channel);
});

bot.chat.registerCommand("-salty", function (args, channel, rawArgs, rawMsg) {
  bot.chat.deleteMessage(rawMsg.id, channel);
  bot.chat.sendMessage(
    "▒▒▒▒▒▒▒▒▒▒▒▒▒▒▄▄██████▄\n" +
    "▒▒▒▒▒▒▒▒▒▒▄▄████████████▄\n" +
    "▒▒▒▒▒▒▄▄██████████████████\n" +
    "▒▒▒▄████▀▀▀██▀██▌███▀▀▀████\n" +
    "▒▒▐▀████▌▀██▌▀▐█▌████▌█████▌\n" +
    "▒▒█▒▒▀██▀▀▐█▐█▌█▌▀▀██▌██████\n" +
    "▒▒█▒▒▒▒████████████████████▌\n" +
    "▒▒▒▌▒▒▒▒█████░░░░░░░██████▀\n" +
    "▒▒▒▀▄▓▓▓▒███░░░░░░█████▀▀\n" +
    "▒▒▒▒▀░▓▓▒▐█████████▀▀▒\n" +
    "▒▒▒▒▒░░▒▒▐█████▀▀▒▒▒▒▒▒\n" +
    "▒▒░░░░░▀▀▀▀▀▀▒▒▒▒▒▒▒▒▒\n" +
    "▒▒▒░░░░░░░░▒▒▒▒▒▒▒▒▒▒",
    channel);
});

bot.chat.registerCommand("-help",
  "I do not help mere peasants.\n" +
  "....................../´¯/)\n" +
  "....................,/¯../\n" +
  ".................../..../\n" +
  "............./´¯/'...'/´¯¯`·¸\n" +
  "........../'/.../..../......./¨¯\n" +
  ".......('(...´...´.... ¯~/'...')\n" +
  ".........\.................'...../\n" +
  "..........''...\.......... _.·´\n" +
  "............\..............(\n" +
  "..............\.............\..."
);

bot.chat.registerCommand("-qlex",
  "▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄\n" +
  "████▌▄▌▄▐▐▌█████\n" +
  "████▌▄▌▄▐▐▌▀████\n" +
  "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀"
);

bot.chat.registerCommand("-play", function (args, channel, rawArgs, rawMsg) {
  if (musicStatus == "off") bot.chat.sendMessage("Not connected to voice! Enable the music player using -music on!", channel);
  else if (musicStatus == "connecting") bot.chat.sendMessage("Currently connecting to voice! Please wait a few seconds and try again.", channel);
  else if (shuffle) bot.chat.sendMessage("Shuffle is currently enabled! Disable it with -shuffle off to queue a song again!.", channel);
  else if (args.length != 1) bot.chat.sendMessage("Invalid arguments! Please follow the form -play <url>!", channel);
  else {
    var videoUrl = args[0];

    if (videoUrl.split("=")[0].includes("list")) parsePlaylist(videoUrl.split("=")[1], channel, rawMsg);
    else queueSong(videoUrl, channel, rawMsg);
  }
});

function queueSong(url, channel, rawMsg) {
  var videoInfo = {
    addedBy: rawMsg.author.username
  };

  youtubeDL.getInfo(url, function (e, info) {
    if (e) {
      console.error("Error downloading video " + url + ":", e);
      return;
    }

    videoInfo.id = info.id;
    videoInfo.title = info.title;
    videoInfo.duration = {};
    videoInfo.duration.raw = info.duration;
    videoInfo.duration.split = info.duration.split(":");

    if (videoInfo.duration.split.length == 3) {
      videoInfo.duration.hours = parseInt(videoInfo.duration.split[0]);
      videoInfo.duration.minutes = parseInt(videoInfo.duration.split[1]);
      videoInfo.duration.seconds = parseInt(videoInfo.duration.split[2]);
    } else if (videoInfo.duration.split.length == 2) {
      videoInfo.duration.hours = 0;
      videoInfo.duration.minutes = parseInt(videoInfo.duration.split[0]);
      videoInfo.duration.seconds = parseInt(videoInfo.duration.split[1]);
    } else if (videoInfo.duration.split.length == 1) {
      videoInfo.duration.hours = 0;
      videoInfo.duration.minutes = 0;
      videoInfo.duration.seconds = parseInt(videoInfo.duration.split[0]);
    }

    videoInfo.duration.t = ((videoInfo.duration.hours * 3600) + (videoInfo.duration.minutes * 60) + videoInfo.duration.seconds) * 1000;

    if (videoInfo.duration.hours >= 1 || videoInfo.duration.minutes > 30) bot.chat.sendMessage("Video " + videoInfo.title + " is too long to be played! [" + formatTime(videoInfo.duration.t) + "]", channel);
    else if (info.formats[1].filesize > 100000000) bot.chat.sendMessage("Video " + videoInfo.title + " is too large to be played! [" + Math.ceil(info.formats[1].filesize/1000000) + "MB]", channel);
    else {
      fs.stat(path.join("music/", videoInfo.id + ".mp3"), function (e) {
        if (e == null) {
          queue[queue.length] = videoInfo;
          if (queue.length == 1 && nowPlaying == {}) bot.chat.sendMessage("**" + videoInfo.title + "** is now playing!", channel);
          else if (queue.length == 1) bot.chat.sendMessage("**" + videoInfo.title + "** is queued to be played next!", channel);
          else bot.chat.sendMessage("Added **" + videoInfo.title + "** to queue in position " + queue.length + "!", channel);

          if (typeof nowPlaying.title == 'undefined') playNextSong(false);
        } else if (e.code == "ENOENT") {
          bot.chat.triggerTyping(channel);

          var downloader = youtubeDL(url);
          downloader.pipe(fs.createWriteStream(path.join("music/", videoInfo.id + '.mp4')));

          downloader.on('error', function (e) {
            console.error("Error downloading video:", e)
          });

          downloader.on('end', function () {
            bot.chat.triggerTyping(channel);

            convertMP4(videoInfo.id, function () {
              queue[queue.length] = videoInfo;
              if (queue.length == 1 && nowPlaying == {}) bot.chat.sendMessage("**" + videoInfo.title + "** is now playing!", channel);
              else if (queue.length == 1) bot.chat.sendMessage("**" + videoInfo.title + "** is queued to be played next!", channel);
              else bot.chat.sendMessage("Added **" + videoInfo.title + "** to queue in position " + queue.length + "!", channel);

              if (typeof nowPlaying.title == 'undefined') playNextSong(false);
            });
          });
        }
      });
    }
  });
}

bot.chat.registerCommand("-queue", function (args, channel) {
  if (musicStatus == "off") bot.chat.sendMessage("Not connected to voice! Enable the music player using -music on!", channel);
  else if (musicStatus == "connecting") bot.chat.sendMessage("Currently connecting to voice! Please wait a few seconds and try again.", channel);
  else if (typeof nowPlaying.title == "undefined") bot.chat.sendMessage("No songs currently queued! Queue one with -play <url>!", channel);
  else {
    var queueMsg = "Now playing: **" + nowPlaying.title + "** [" + formatTime(songDuration) + "/" + formatTime(nowPlaying.duration.t) + "].\n";

    for (var song in queue) {
      var songPosition = parseInt(song) + 1;
      var song = queue[song];

      queueMsg = queueMsg + songPosition + ". **" + song.title + "** queued by **" + song.addedBy + "**\n"
    }

    bot.chat.sendMessage(queueMsg, channel);
  }
});

bot.chat.registerCommand("-skip", function (args, channel, rawAuthor, rawMsg) {
  if (musicStatus == "off") bot.chat.sendMessage("Not connected to voice! Enable the music player using -music on!", channel);
  else if (musicStatus == "connecting") bot.chat.sendMessage("Currently connecting to voice! Please wait a few seconds and try again.", channel);
  else if (typeof nowPlaying.title == "undefined") bot.chat.sendMessage("No song currently playing! Queue one with -play <url>!", channel);
  else if (skipVotes.indexOf(rawMsg.author.id) > -1) bot.chat.sendMessage("You have already voted to skip this song!", channel);
  else if (skipVotes.length < 2) {
    skipVotes[skipVotes.length] = rawMsg.author.id;
    bot.chat.sendMessage("Voted to skip song **" + nowPlaying.title + "**. **" + (3 - skipVotes.length) + "** more votes needed!", channel);
  } else {
    bot.chat.sendMessage("Skipped song **" + nowPlaying.title + "**.", channel);
    player.kill();
  }
});

function playNextSong(kill) {
  if (kill) {
    clearInterval(songTimer);
  }
  songStartTime = new Date().getTime();
  songTimer = setInterval(function () {
    songDuration = new Date().getTime() - songStartTime;
  }, 1);
  skipVotes = [];

  if (shuffle) shuffleFiles();
  else if (queue.length != 0) {
    nowPlaying = queue[0];

    queue.splice(0, 1);

    playFile(nowPlaying.id + ".mp3");
    bot.chat.sendMessage("Now playing **" + nowPlaying.title + "**.", "200721172642398209")
  } else {
    nowPlaying = {};
  }
}

function convertMP4(filename, cb) {
  var converter = spawn("ffmpeg", [
    "-i",
    path.join("music/", filename + '.mp4'),
    "-b:a",
    "192K",
    "-vn",
    path.join("music/", filename + '.mp3')
  ]);

  converter.on('error', function (e) {
    console.error("Error converting video:", e)
  });

  converter.on('exit', function () {
    cb();
  });
}

function playFile(file) {
  player = spawn('ffmpeg', [
    '-i', path.join("music/", file),
    '-f', 's16le',
    '-vol', '16',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ], {stdio: ['pipe', 'pipe', 'ignore']});

  player.stdout.once('readable', function () {
    sendAudio(player.stdout);
  });

  player.stdout.once('end', function () {
    playNextSong(true);
  });
}

bot.chat.registerCommand("-music", function (args, channel, rawArgs, rawData) {
  if (args.length != 1) bot.chat.sendMessage("Invalid arguments! Please use the form -music <on|off|move>", channel);
  else if (args[0] == "on") {
    if (musicStatus == "off") {
      bot.voice.joinVoice("160891109231296512", "173490964973748224");
      bot.chat.sendMessage("Joining voice channel.", channel);
      musicStatus = "connecting";

      moveBot(rawData.author.id);
    } else if (musicStatus == "connected") bot.chat.sendMessage("Already connected to voice.", channel);
    else if (musicStatus == "connecting") bot.chat.sendMessage("Already connecting to voice.", channel);
  } else if (args[0] == "move") {
    if (musicStatus == "off") bot.chat.sendMessage("Not connected to voice! Enable the music player using -music on!", channel);
    else if (musicStatus == "connecting") bot.chat.sendMessage("Currently connecting to voice! Please wait a few seconds and try again.", channel);
    else moveBot(rawData.author.id);
  } else if (args[0] == "off") {
    if (musicStatus == "off") bot.chat.sendMessage("Not connected to voice! Enable the music player using -music on!", channel);
    else if (musicStatus == "connecting") bot.chat.sendMessage("Currently connecting to voice! Please wait a few seconds and try again.", channel);
    else {
      bot.voice.leaveVoice("160891109231296512");

      queue = [];
      nowPlaying = {};
      musicStatus = "off";

      bot.chat.sendMessage("Disconnected from voice.", channel)
    }
  } else bot.chat.sendMessage("Invalid arguments! Please use the form -music <on|off|move>", channel);
});

bot.events.on("voiceTransmissionReady", function (sendAudioFunction) {
  musicStatus = "connected";

  sendAudio = sendAudioFunction;
});

bot.chat.registerCommand("-id", function (args, channel, rawArgs, rawData) {
  bot.chat.sendMessage("ID of this channel is **" + channel + "**. Your user id is **" + rawData.author.id + "**.", channel);
});

function moveBot(user) {
  bot.voice.moveVoice("160891109231296512", bot.voice.findChannelOfUser(user));
}

function parsePlaylist(playlist, channel, rawMsg) {
  bot.chat.sendMessage("Fetching playlist data.", channel);
  bot.chat.triggerTyping(channel);

  var req = https.request({
    hostname: "www.googleapis.com",
    path: "/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=" + playlist + "&fields=items%2FcontentDetails&key=AIzaSyBoVxaW1LSqa7Sxkkxl0dSiDzMSUiNsO4M",
    method: "GET"
  }, function (res) {
    res.on('data', function (d) {
      try {
        d = d.toString("utf8");
        bot.chat.triggerTyping(channel);
        d = JSON.parse(d);

        for (var video in d.items) {
          video = d.items[video];

          queueSong("http://youtube.com/watch?v=" + video.contentDetails.videoId, channel, rawMsg);
        }
      } catch (e) {
        console.log("Error parsing response: " + e)
      }
    });

    res.on('error', function (e) {
      console.error("Error sending HTTP payload: " + e)
    })
  });
  req.end();
}

function formatTime(time) {
  var minutes = Math.floor(time / 60000);
  var hours = Math.floor(minutes / 60);
  var seconds = Math.floor(((time) - (minutes * 60000)) / 1000);
  minutes -= hours * 60;
  if (minutes < 10 && hours > 0) minutes = "0" + minutes;
  if (seconds < 10) seconds = "0" + seconds;
  if (hours > 0) return hours + ":" + minutes + ":" + seconds;
  else return minutes + ":" + seconds;
}

bot.chat.registerCommand("-shuffle", function (args, channel) {
  if (musicStatus == "off") bot.chat.sendMessage("Not connected to voice! Enable the music player using -music on!", channel);
  else if (musicStatus == "connecting") bot.chat.sendMessage("Currently connecting to voice! Please wait a few seconds and try again.", channel);
  else if (args.length != 1) bot.chat.sendMessage("Invalid arguments! Please use the form -shuffle <on|off>", channel);
  else if (args[0] == "on") {
    if (shuffle) bot.chat.sendMessage("Shuffle is already enabled!", channel);
    else {
      queue = [];
      shuffle = true;
      bot.chat.sendMessage("Shuffle is now enabled!", channel);
      shuffleFiles();
    }
  } else if (args[0] == "off") {
    if (!shuffle) bot.chat.sendMessage("Shuffle is already disabled!", channel);
    else {
      shuffle = false;
      bot.chat.sendMessage("Shuffle is now disabled!", channel);
    }
  } else bot.chat.sendMessage("Invalid arguments! Please use the form -shuffle <on|off>", channel);
});

function shuffleFiles() {
  fs.readdir("music", function (err, files) {
    var id = files[Math.round(Math.random() * files.length - 1)].split(".")[0];
    var videoInfo = {};

    youtubeDL.getInfo("http://youtu.be/" + id, function (e, info) {
      if (e) {
        console.error("Error downloading video " + id + ":", e);
        return;
      }

      videoInfo.id = info.id;
      videoInfo.title = info.title;
      videoInfo.duration = {};
      videoInfo.duration.raw = info.duration;
      videoInfo.duration.split = info.duration.split(":");

      if (videoInfo.duration.split.length == 3) {
        videoInfo.duration.hours = parseInt(videoInfo.duration.split[0]);
        videoInfo.duration.minutes = parseInt(videoInfo.duration.split[1]);
        videoInfo.duration.seconds = parseInt(videoInfo.duration.split[2]);
      } else if (videoInfo.duration.split.length == 2) {
        videoInfo.duration.hours = 0;
        videoInfo.duration.minutes = parseInt(videoInfo.duration.split[0]);
        videoInfo.duration.seconds = parseInt(videoInfo.duration.split[1]);
      } else if (videoInfo.duration.split.length == 1) {
        videoInfo.duration.hours = 0;
        videoInfo.duration.minutes = 0;
        videoInfo.duration.seconds = parseInt(videoInfo.duration.split[0]);
      }

      videoInfo.duration.t = ((videoInfo.duration.hours * 3600) + (videoInfo.duration.minutes * 60) + videoInfo.duration.seconds) * 1000;

      if (videoInfo.duration.hours >= 1 || videoInfo.duration.minutes > 30) {}
      else if (info.formats[1].filesize > 100000000) {}
      else {
        fs.stat(path.join("music/", videoInfo.id + ".mp3"), function (e) {
          if (e == null) {
            songStartTime = new Date().getTime();
            songTimer = setInterval(function () {
              songDuration = new Date().getTime() - songStartTime;
            }, 1);
            skipVotes = [];

            nowPlaying = videoInfo;

            playFile(nowPlaying.id + ".mp3");
            bot.chat.sendMessage("Now playing **" + nowPlaying.title + "**.", "200721172642398209");
          } else if (e.code == "ENOENT") {
            shuffleFiles();
            console.log("This shouldn't happen. Congrats, you broke things!");
          }
        });
      }
    });
  });
}
