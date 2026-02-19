let ws = new WebSocket(
  location.protocol === "https:"
    ? "wss://" + location.host
    : "ws://" + location.host
);

let currentRoom = null;
let playerNumber = null;

function signup() {
  fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.value,
      password: password.value
    })
  }).then(r => r.json()).then(d =>
    alert(d.success ? "Signed up!" : "Signup failed")
  );
}

function login() {
  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.value,
      password: password.value
    })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      auth.style.display = "none";
      game.style.display = "block";
      loadStats();
    } else {
      alert("Login failed");
    }
  });
}

function loadStats() {
  fetch("/me")
    .then(r => r.json())
    .then(data => {
      stats.innerText =
        `XP: ${data.xp} | Wins: ${data.wins} | Losses: ${data.losses}`;
    });
}

function findMatch() {
  ws.send(JSON.stringify({ type: "findMatch" }));
}

function attack() {
  ws.send(JSON.stringify({ type: "attack", roomId: currentRoom }));
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "start") {
    currentRoom = data.roomId;
    playerNumber = data.you;
    battle.style.display = "block";
  }

  if (data.type === "update") {
    myhp.innerText = playerNumber === 1 ? data.p1hp : data.p2hp;
    enemyhp.innerText = playerNumber === 1 ? data.p2hp : data.p1hp;
  }

  if (data.type === "win") {
    alert("You won!");
    battle.style.display = "none";
  }
};
