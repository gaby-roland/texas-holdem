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
    playerTurn: 0,
    players: [],
    communityCards: [],
    amount: 25,
    callAmount: 0,
    alertHeader: "",
    alertBody: ""
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
    displayPublicOrPrivate: function (event) {
      document.getElementById('public-or-private').style.display = 'inline-block';
      document.getElementById('public-table').style.display = 'none';
      document.getElementById('table').style.display = 'none';
      document.getElementById('player-moves').style.display = 'none';
    },

    displayPublicGames: function (event) {
      document.getElementById('public-or-private').style.display = 'none';
      document.getElementById('public-table').style.display = 'inline-block';
      document.getElementById('table').style.display = 'none';
      document.getElementById('player-moves').style.display = 'none';
    },

    displayPrivateGames: function (event) {
      console.log('create_private');
    },

    leaveTable: function (event) {
      document.getElementById('public-or-private').style.display = 'none';
      document.getElementById('public-table').style.display = 'inline-block';
      document.getElementById('table').style.display = 'none';
      document.getElementById('player-moves').style.display = 'none';
      socket.emit('leaveTable');
    },

    joinTable: function (event) {
      document.getElementById('public-or-private').style.display = 'none';
      document.getElementById('public-table').style.display = 'none';
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
  app.players = data.players;
  app.communityCards = data.communityCards;
  app.playerTurn = data.playerTurn;

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
    app.callAmount = data.currentBet - data.thisPlayer.chipsOnTable;
    document.getElementById('play-button').classList.add('disabled');
    document.getElementById('spectate-button').classList.remove('disabled');

    if (data.playerTurn != null && data.players[data.playerTurn] != null && data.players[data.playerTurn].name == data.thisPlayer.name) {
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

      if (app.amount != null && app.amount > (data.currentBet - data.thisPlayer.chipsOnTable)) {
        document.getElementById('raise-button').classList.remove('disabled');
      }
      else {
        document.getElementById('raise-button').classList.add('disabled');
      }
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

// Get the modal
var modal = document.getElementById("alertModal");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
}

socket.on('alert', function (data) {
  //alert("Too many requests! Try again in " + data.wait + " ms.");
  app.alertHeader = data.header;
  app.alertBody = data.message;
  modal.style.display = "block";
});