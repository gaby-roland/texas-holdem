var socket = io();

Vue.component('card', {
  template: `<div class="card" :class="['suits-' + card.suit, 'values-' + card.value]">
		            <h1>{{card.value}}</h1>
	            	<div class="suits" :class="card.suit"></div>
		            <h1>{{card.value}}</h1>
	            </div>`,
  props: ['card']
});

let app = new Vue({
  el: '.vue-container',
  data: {
    playerName: "",
    playerWallet: "",
    playerTurn: 0,
    players: [],
    communityCards: [],
    potAmount: 0,
    currentBet: 0,
    chipsOnTable: 0,
    amount: 25,
    callAmount: 0,
    alertHeader: "",
    alertBody: "",
    leaderboard: []
  },
  computed: {
    callStyle() {
      var padding = 25 + (this.callAmount.toString().length - 1) * 7
      return "--content: '$" + this.callAmount + "'; --padding: " + padding + "px; background-color: #4CAF50; width: 100px;";
    },
    raiseStyle() {
      var padding = 25 + (this.amount.toString().length - 1) * 7
      return "--content: '$" + this.amount + "'; --padding: " + padding + "px; background-color: #4CAF50; width: 100px;";
    }
  },
  methods: {
    getLeaderboard: function (event) {
      socket.emit('getLeaderboard');
      document.getElementById('player-dashboard').style.display = 'none';
      document.getElementById('leaderboard').style.display = 'inline-block';
      document.getElementById('table').style.display = 'none';
      document.getElementById('player-moves').style.display = 'none';
    },
    backToDashboard: function () {
      document.getElementById('player-dashboard').style.display = 'inline-block';
      document.getElementById('leaderboard').style.display = 'none';
      document.getElementById('table').style.display = 'none';
      document.getElementById('player-moves').style.display = 'none';
    },
    leaveTable: function (event) {
      document.getElementById("log-box").value = "";
      document.getElementById('player-dashboard').style.display = 'inline-block';
      document.getElementById('leaderboard').style.display = 'none';
      document.getElementById('table').style.display = 'none';
      document.getElementById('player-moves').style.display = 'none';
      socket.emit('leaveTable');
    },

    joinTable: function (event) {
      document.getElementById('player-dashboard').style.display = 'none';
      document.getElementById('leaderboard').style.display = 'none';
      document.getElementById('table').style.display = 'inline-block';
      document.getElementById('player-moves').style.display = 'inline-block';
      socket.emit('joinTable', {
        table: event.srcElement.value
      });
    },

    startPlaying: function (event) {
      socket.emit('startPlaying');
    },

    startSpectating: function (event) {
      socket.emit('startSpectating');
    },

    raise: function (event) {
      socket.emit('raise', {
        amount: this.amount
      });
      this.amount = document.getElementById("raise-amount").min;
    },

    call: function (event) {
      socket.emit('call');
    },

    check: function (event) {
      socket.emit('check');
    },

    fold: function (event) {
      socket.emit('fold');
    }
  }
});

socket.on('gameState', function (data) {
  app.potAmount = data.potAmount;
  app.players = data.players;
  app.communityCards = data.communityCards;
  app.playerTurn = data.playerTurn;
  app.currentBet = data.currentBet;

  if (data.log != null && data.log != "") {
    var logBox = document.getElementById("log-box");
    logBox.value += data.log;
    logBox.scrollTop = logBox.scrollHeight;
  }

  if (!data.thisPlayer) {
    document.getElementById('play-button').classList.remove('disabled');
    document.getElementById('spectate-button').classList.add('disabled');
    document.getElementById('raise-button').classList.add('disabled');
    document.getElementById('raise-amount').disabled = true;
    document.getElementById('call-button').classList.add('disabled');
    document.getElementById('check-button').classList.add('disabled');
    document.getElementById('fold-button').classList.add('disabled');
  }
  else {
    app.chipsOnTable = data.thisPlayer.chipsOnTable;
    app.callAmount = app.currentBet - app.chipsOnTable;
    document.getElementById('play-button').classList.add('disabled');
    document.getElementById('spectate-button').classList.remove('disabled');

    if (data.inProgress && data.playerTurn != null && data.players[data.playerTurn] != null && data.players[data.playerTurn].name == data.thisPlayer.name) {
      document.getElementById('fold-button').classList.remove('disabled');
      document.getElementById('raise-amount').disabled = false;
      if (data.currentBet > data.thisPlayer.chipsOnTable) {
        document.getElementById('check-button').classList.add('disabled');
        document.getElementById('call-button').classList.remove('disabled');
      }
      else {
        document.getElementById('check-button').classList.remove('disabled');
        document.getElementById('call-button').classList.add('disabled');
      }

      updateRaiseButtonState();
    }
    else {
      document.getElementById('raise-button').classList.add('disabled');
      document.getElementById('raise-amount').disabled = true;
      document.getElementById('call-button').classList.add('disabled');
      document.getElementById('check-button').classList.add('disabled');
      document.getElementById('fold-button').classList.add('disabled');
    }
  }
});

function updateRaiseButtonState() {
  if (app.amount != null && app.amount > (app.currentBet - app.chipsOnTable)) {
    document.getElementById('raise-button').classList.remove('disabled');
  }
  else {
    document.getElementById('raise-button').classList.add('disabled');
  }
}

socket.on('userInfo', function (data) {
  app.playerName = data.playerName;
  app.playerWallet = data.playerWallet;
});

socket.on('leaderboard', function (data) {
  console.log(data.leaderboard);
  app.leaderboard = data.leaderboard;
  console.log(app.leaderboard);
})

// Get the modal
var modal = document.getElementById("alertModal");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
}

socket.on('alert', function (data) {
  app.alertHeader = data.header;
  app.alertBody = data.message;
  modal.style.display = "block";
});