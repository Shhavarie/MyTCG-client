/* =========================================================
  v6 根本修正版
  - プレイヤー間で衝突しないグローバル一意 instanceId
  - 相手デッキをローカル生成しない
  - イベントにカード実体を同梱して到着順・初期同期に強くする
  - stateSnapshot が相手の deckCode / 自分のデッキを上書きしない
========================================================= */

/* =========================================================
  同期ドロー
========================================================= */
function applyDraw(player, payload) {
    const { cardId, faceDown } = payload;

    let deck, hand;

    if (player === "user1") {
        deck = gameState.player1.deck;
        hand = gameState.player1.hand;
    } else {
        deck = gameState.player2.deck;
        hand = gameState.player2.hand;
    }

    // デッキから該当カードを探す
    const card = deck.find(c => c.instanceId === cardId);
    if (!card) return;

    // デッキから削除
    deck.splice(deck.indexOf(card), 1);

    // 裏向き設定
    card.faceDown = faceDown;

    // 手札に追加
    if (!hand.some(c => c.instanceId === cardId)) {
        hand.push(card);
    }
    if (!gameState.handCards.some(c => c.instanceId === cardId)) {
        gameState.handCards.push(card);
    }
}/* =========================================================
  同期カード移動
========================================================= */
function applyMove(player, payload) {
    const { cardId, x, y } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    card.x = x;
    card.y = y;

    const target = player === "user1" ? gameState.player1 : gameState.player2;
    const ownedCard = target?.board?.find(c => c.instanceId === cardId);
    if (ownedCard && ownedCard !== card) {
        ownedCard.x = x;
        ownedCard.y = y;
    }
}/* =========================================================
  同期裏向き
========================================================= */
function applyFlip(player, payload) {
    const { cardId, faceDown } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    card.faceDown = !!faceDown;

    const target = player === "user1" ? gameState.player1 : gameState.player2;
    const ownedCard = target?.board?.find(c => c.instanceId === cardId);
    if (ownedCard && ownedCard !== card) {
        ownedCard.faceDown = !!faceDown;
    }
}
/* =========================================================
  同期回転
========================================================= */
function applyHandFlip(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    target.hand = target.hand || [];
    target.deck = target.deck || [];

    target.deck = target.deck.filter(c => c.instanceId !== payload.cardId);
    target.board = (target.board || []).filter(c => c.instanceId !== payload.cardId);

    card.faceDown = !!payload.faceDown;

    if (!target.hand.some(c => c.instanceId === payload.cardId)) {
        target.hand.push(card);
    }

    gameState.handCards = gameState.handCards.filter(c => c.instanceId !== payload.cardId);
    gameState.handCards.push(card);
}


function applyRemoteLog(player, payload) {
    if (!payload?.message) return;
    addLog(payload.message, false, payload.id);
}

function applyDice(player, payload) {
    const die1 = Number(payload?.die1);
    const die2 = Number(payload?.die2);
    const result = Number(payload?.result);
    if (![die1, die2, result].every(Number.isFinite)) return;

    const resultElement = document.getElementById("dice-result");
    const numberElement = resultElement?.querySelector(".dice-result-number");
    if (numberElement) numberElement.textContent = result;
    resultElement?.classList.remove("hidden");
    setTimeout(() => resultElement?.classList.add("hidden"), 1200);

    addLog(`${getRoleName(player)}が2D6を振って${die1}+${die2}＝${result}をだしました`, false);
}

/* =========================================================
  同期回転
========================================================= */
function applyRotate(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    targetCard.rotated = !!(payload.card ? (payload.card.rotated ?? payload.card.rotation) : (payload.rotated ?? payload.rotation));
    targetCard.rotation = targetCard.rotated;

    let globalCard = (gameState.boardCards || []).find(c => c.instanceId === cardId);
    if (!globalCard) {
        globalCard = JSON.parse(JSON.stringify(targetCard));
        gameState.boardCards.push(globalCard);
    } else {
        globalCard.rotated = targetCard.rotated;
        globalCard.rotation = targetCard.rotation;
    }
}
/* =========================================================
  同期カウンター
========================================================= */
function applyCounter(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    if (payload.card && payload.card.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.card.counters));
    } else if (payload.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.counters));
    } else {
        targetCard.counters = targetCard.counters || {};
        const type = payload.color;
        targetCard.counters[type] = Number(targetCard.counters[type] || 0) + Number(payload.value || 0);
    }

    updateCounterEverywhere(cardId, targetCard.counters);

    // 相手側配列を表示元にして盤面配列を再構築
    gameState.boardCards = [
        ...(gameState.player1?.board || []),
        ...(gameState.player2?.board || [])
    ];
}
/* =========================================================
   同期初期配置
========================================================= */
function applyInitial(player, payload) {
    const { cardId, x, y } = payload;

    const card = findCardInDeckOrHand(player, cardId);
    if (!card) return;

    card.x = x;
    card.y = y;

    gameState.boardCards.push(card);
}/* =========================================================
   同期PP
========================================================= */

/* =========================================================
   ゲーム状態スナップショット同期
   新しく接続した側が、接続前の盤面・手札・デッキ順も取得できるようにする
========================================================= */
function createGameSnapshot() {
    return {
        player1: gameState.player1,
        player2: gameState.player2,
        boardCards: gameState.boardCards,
        handCards: gameState.handCards,
        deckCode: gameState.deckCode,
        logs: gameState.logs,
        logEventIds: gameState.logEventIds
    };
}

function applyStateSnapshot(snapshot, senderPlayer) {
    if (!snapshot || !senderPlayer) return;

    const clone = JSON.parse(JSON.stringify(snapshot));
    const remote = clone[senderPlayer];

    if (!remote) return;

    // スナップショットを送ってきたプレイヤーの状態だけを更新する。
    // 自分の状態まで上書きしないことで、同時にゲーム開始した場合の競合を防ぐ。
    const uniqueByInstanceId = list => {
        const seen = new Set();
        return (Array.isArray(list) ? list : []).filter(card => {
            const id = card?.instanceId;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    };

    gameState[senderPlayer] = {
        deck: uniqueByInstanceId(remote.deck),
        hand: uniqueByInstanceId(remote.hand),
        board: uniqueByInstanceId(remote.board)
    };

    // 接続前のログも共有する
    if (Array.isArray(clone.logs)) {
        const existing = new Set(gameState.logs || []);
        gameState.logs = [...(gameState.logs || []), ...clone.logs.filter(log => !existing.has(log))].slice(-500);
        renderLogs();
    }

    // 相手のデッキコードで自分のデッキ設定を上書きしない。
    // 各プレイヤーのデッキはそれぞれのクライアントが管理する。

    // 各プレイヤーの盤面・手札から全体配列を再構築
    gameState.boardCards = [
        ...(gameState.player1.board || []),
        ...(gameState.player2.board || [])
    ];

    gameState.handCards = [
        ...(gameState.player1.hand || []),
        ...(gameState.player2.hand || [])
    ];

    renderAll();
    console.log("ゲーム状態を同期しました:", senderPlayer);
}

function sendStateSnapshot() {
    sendGameEvent("stateSnapshot", createGameSnapshot());
}

/* =========================================================
   同期受信
========================================================= */
function applyGameEvent(event) {
    const { type, player, payload } = event;

    switch (type) {
        case "stateRequest":
            sendStateSnapshot();
            return;
        case "stateSnapshot":
            applyStateSnapshot(payload, player);
            return;
        case "draw": applyDraw(player, payload); break;
        case "log": applyRemoteLog(player, payload); break;
        case "dice": applyDice(player, payload); break;
        case "search": applySearch(player, payload); break;
        case "play": applyPlay(player, payload); break;
        case "move": applyMove(player, payload); break;
        case "flip": applyFlip(player, payload); break;
        case "handFlip": applyHandFlip(player, payload); break;
        case "rotate": applyRotate(player, payload); break;
        case "counter": applyCounter(player, payload); break;
        case "initial": applyInitial(player, payload); break;

        // 任意イベント
        case "select": applySelect(player, payload); break;
        case "endTurn": applyEndTurn(player, payload); break;
        case "shuffle": applyShuffle(player, payload); break;
        case "remove": applyRemove(player, payload); break;
        case "handRemove": applyHandRemove(player, payload); break;
        case "returnHand": applyReturnHand(player, payload); break;
        case "returnDeck": applyReturnDeck(player, payload); break;
    }

    renderAll();
}
/* =========================================================
  同期ドロー
========================================================= */
function getRemoteTarget(player) {
    return player === "user1" ? gameState.player1 : gameState.player2;
}

function getOrCreateRemoteCard(target, payload) {
    if (!target || !payload) return null;

    const cardId = payload.cardId;
    if (!cardId) return null;

    let card =
        (target.hand || []).find(c => c.instanceId === cardId) ||
        (target.deck || []).find(c => c.instanceId === cardId) ||
        (target.board || []).find(c => c.instanceId === cardId) ||
        (gameState.handCards || []).find(c => c.instanceId === cardId) ||
        (gameState.boardCards || []).find(c => c.instanceId === cardId) ||
        null;

    // イベント到着時点で相手のカードがローカルに存在しない場合、
    // イベント自身に含めたカード情報から復元する。
    if (!card && payload.card) {
        card = JSON.parse(JSON.stringify(payload.card));
    }

    return card;
}

function removeCardEverywhere(target, cardId) {
    if (!target) return;

    target.deck = (target.deck || []).filter(c => c.instanceId !== cardId);
    target.hand = (target.hand || []).filter(c => c.instanceId !== cardId);
    target.board = (target.board || []).filter(c => c.instanceId !== cardId);

    gameState.boardCards = (gameState.boardCards || []).filter(c => c.instanceId !== cardId);
    gameState.handCards = (gameState.handCards || []).filter(c => c.instanceId !== cardId);
}

/* =========================================================
   盤面カードを手札へ戻す同期
========================================================= */
function applyReturnHand(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    removeCardEverywhere(target, payload.cardId);
    card.faceDown = false;
    target.hand.push(card);

    gameState.handCards = (gameState.handCards || []).filter(c => c.instanceId !== payload.cardId);
    gameState.handCards.push(card);
}

/* =========================================================
   盤面カードをデッキへ戻す同期
========================================================= */
function applyReturnDeck(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    removeCardEverywhere(target, payload.cardId);
    card.faceDown = true;
    target.deck.unshift(card);
}

/* =========================================================
  同期ドロー
========================================================= */
function applyDraw(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    target.deck = (target.deck || []).filter(c => c.instanceId !== payload.cardId);
    target.board = (target.board || []).filter(c => c.instanceId !== payload.cardId);

    card.faceDown = !!payload.faceDown;

    if (!target.hand.some(c => c.instanceId === payload.cardId)) {
        target.hand.push(card);
    }

    gameState.handCards = gameState.handCards.filter(c => c.instanceId !== payload.cardId);
    gameState.handCards.push(card);

    addLog(`${getRoleName(player)}がカードをドローしました`, false);
}

/* =========================================================
  同期カード移動
========================================================= */
function applyPlay(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    removeCardEverywhere(target, payload.cardId);
    target.board.push(card);

    card.x = Number(payload.x ?? card.x ?? 0);
    card.y = Number(payload.y ?? card.y ?? 0);
    card.faceDown = !!payload.faceDown;

    gameState.boardCards.push(card);
}

function applyMove(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    if (!(target.board || []).some(c => c.instanceId === payload.cardId)) {
        removeCardEverywhere(target, payload.cardId);
        target.board.push(card);
    }

    card.x = Number(payload.x ?? card.x ?? 0);
    card.y = Number(payload.y ?? card.y ?? 0);

    const globalCard = gameState.boardCards.find(c => c.instanceId === payload.cardId);
    if (!globalCard) {
        gameState.boardCards.push(card);
    } else if (globalCard !== card) {
        globalCard.x = card.x;
        globalCard.y = card.y;
    }
}

/* =========================================================
  同期裏向き
========================================================= */
function applyFlip(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    if (!(target.board || []).some(c => c.instanceId === payload.cardId)) {
        removeCardEverywhere(target, payload.cardId);
        target.board.push(card);
    }

    card.faceDown = !!payload.faceDown;

    const globalCard = gameState.boardCards.find(c => c.instanceId === payload.cardId);
    if (globalCard && globalCard !== card) {
        globalCard.faceDown = card.faceDown;
    } else if (!globalCard) {
        gameState.boardCards.push(card);
    }
}

/* =========================================================
  同期回転
========================================================= */
function applyRotate(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    targetCard.rotated = !!(payload.card ? (payload.card.rotated ?? payload.card.rotation) : (payload.rotated ?? payload.rotation));
    targetCard.rotation = targetCard.rotated;

    let globalCard = (gameState.boardCards || []).find(c => c.instanceId === cardId);
    if (!globalCard) {
        globalCard = JSON.parse(JSON.stringify(targetCard));
        gameState.boardCards.push(globalCard);
    } else {
        globalCard.rotated = targetCard.rotated;
        globalCard.rotation = targetCard.rotation;
    }
}

/* =========================================================
  同期カウンター
========================================================= */
function applyCounter(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    if (payload.card && payload.card.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.card.counters));
    } else if (payload.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.counters));
    } else {
        targetCard.counters = targetCard.counters || {};
        const type = payload.color;
        targetCard.counters[type] = Number(targetCard.counters[type] || 0) + Number(payload.value || 0);
    }

    updateCounterEverywhere(cardId, targetCard.counters);

    // 相手側配列を表示元にして盤面配列を再構築
    gameState.boardCards = [
        ...(gameState.player1?.board || []),
        ...(gameState.player2?.board || [])
    ];
}

/* =========================================================
  v6 根本修正版
  - プレイヤー間で衝突しないグローバル一意 instanceId
  - 相手デッキをローカル生成しない
  - イベントにカード実体を同梱して到着順・初期同期に強くする
  - stateSnapshot が相手の deckCode / 自分のデッキを上書きしない
========================================================= */

/* =========================================================
  同期ドロー
========================================================= */
function applyDraw(player, payload) {
    const { cardId, faceDown } = payload;

    let deck, hand;

    if (player === "user1") {
        deck = gameState.player1.deck;
        hand = gameState.player1.hand;
    } else {
        deck = gameState.player2.deck;
        hand = gameState.player2.hand;
    }

    // デッキから該当カードを探す
    const card = deck.find(c => c.instanceId === cardId);
    if (!card) return;

    // デッキから削除
    deck.splice(deck.indexOf(card), 1);

    // 裏向き設定
    card.faceDown = faceDown;

    // 手札に追加
    if (!hand.some(c => c.instanceId === cardId)) {
        hand.push(card);
    }
    if (!gameState.handCards.some(c => c.instanceId === cardId)) {
        gameState.handCards.push(card);
    }
}/* =========================================================
  同期カード移動
========================================================= */
function applyMove(player, payload) {
    const { cardId, x, y } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    card.x = x;
    card.y = y;

    const target = player === "user1" ? gameState.player1 : gameState.player2;
    const ownedCard = target?.board?.find(c => c.instanceId === cardId);
    if (ownedCard && ownedCard !== card) {
        ownedCard.x = x;
        ownedCard.y = y;
    }
}/* =========================================================
  同期裏向き
========================================================= */
function applyFlip(player, payload) {
    const { cardId, faceDown } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    card.faceDown = !!faceDown;

    const target = player === "user1" ? gameState.player1 : gameState.player2;
    const ownedCard = target?.board?.find(c => c.instanceId === cardId);
    if (ownedCard && ownedCard !== card) {
        ownedCard.faceDown = !!faceDown;
    }
}
/* =========================================================
  同期回転
========================================================= */
function applyHandFlip(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    target.hand = target.hand || [];
    target.deck = target.deck || [];

    target.deck = target.deck.filter(c => c.instanceId !== payload.cardId);
    target.board = (target.board || []).filter(c => c.instanceId !== payload.cardId);

    card.faceDown = !!payload.faceDown;

    if (!target.hand.some(c => c.instanceId === payload.cardId)) {
        target.hand.push(card);
    }

    gameState.handCards = gameState.handCards.filter(c => c.instanceId !== payload.cardId);
    gameState.handCards.push(card);
}

/* =========================================================
  同期回転
========================================================= */
function applyRotate(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    targetCard.rotated = !!(payload.card ? (payload.card.rotated ?? payload.card.rotation) : (payload.rotated ?? payload.rotation));
    targetCard.rotation = targetCard.rotated;

    let globalCard = (gameState.boardCards || []).find(c => c.instanceId === cardId);
    if (!globalCard) {
        globalCard = JSON.parse(JSON.stringify(targetCard));
        gameState.boardCards.push(globalCard);
    } else {
        globalCard.rotated = targetCard.rotated;
        globalCard.rotation = targetCard.rotation;
    }
}
/* =========================================================
  同期カウンター
========================================================= */
function applyCounter(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    if (payload.card && payload.card.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.card.counters));
    } else if (payload.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.counters));
    } else {
        targetCard.counters = targetCard.counters || {};
        const type = payload.color;
        targetCard.counters[type] = Number(targetCard.counters[type] || 0) + Number(payload.value || 0);
    }

    updateCounterEverywhere(cardId, targetCard.counters);

    // 相手側配列を表示元にして盤面配列を再構築
    gameState.boardCards = [
        ...(gameState.player1?.board || []),
        ...(gameState.player2?.board || [])
    ];
}
/* =========================================================
   同期初期配置
========================================================= */
function applyInitial(player, payload) {
    const { cardId, x, y } = payload;

    const card = findCardInDeckOrHand(player, cardId);
    if (!card) return;

    card.x = x;
    card.y = y;

    gameState.boardCards.push(card);
}/* =========================================================
   同期PP
========================================================= */

/* =========================================================
   ゲーム状態スナップショット同期
   新しく接続した側が、接続前の盤面・手札・デッキ順も取得できるようにする
========================================================= */
function createGameSnapshot() {
    return {
        player1: gameState.player1,
        player2: gameState.player2,
        boardCards: gameState.boardCards,
        handCards: gameState.handCards,
        deckCode: gameState.deckCode,
        logs: gameState.logs,
        logEventIds: gameState.logEventIds
    };
}

function applyStateSnapshot(snapshot, senderPlayer) {
    if (!snapshot || !senderPlayer) return;

    const clone = JSON.parse(JSON.stringify(snapshot));
    const remote = clone[senderPlayer];
    if (!remote) return;

    gameState[senderPlayer] = {
        deck: remote.deck || [],
        hand: remote.hand || [],
        board: remote.board || []
    };

    /* 1P/2P共通ログをマージ */
    if (Array.isArray(clone.logs)) {
        gameState.logs = Array.isArray(gameState.logs) ? gameState.logs : [];
        const merged = new Set(gameState.logs);
        clone.logs.forEach(log => {
            if (!merged.has(log)) {
                gameState.logs.push(log);
                merged.add(log);
            }
        });
        gameState.logs = gameState.logs.slice(-500);
    }
    if (Array.isArray(clone.logEventIds)) {
        gameState.logEventIds = Array.isArray(gameState.logEventIds) ? gameState.logEventIds : [];
        const mergedIds = new Set(gameState.logEventIds);
        clone.logEventIds.forEach(id => {
            if (!mergedIds.has(id)) {
                gameState.logEventIds.push(id);
                mergedIds.add(id);
            }
        });
        gameState.logEventIds = gameState.logEventIds.slice(-500);
    }

    gameState.boardCards = [
        ...(gameState.player1.board || []),
        ...(gameState.player2.board || [])
    ];

    gameState.handCards = [
        ...(gameState.player1.hand || []),
        ...(gameState.player2.hand || [])
    ];

    renderAll();
    renderLogs();
    console.log("ゲーム状態を同期しました:", senderPlayer);
}

function sendStateSnapshot() {
    sendGameEvent("stateSnapshot", createGameSnapshot());
}

/* =========================================================
   同期受信
========================================================= */
function applyGameEvent(event) {
    const { type, player, payload } = event;

    switch (type) {
        case "stateRequest":
            sendStateSnapshot();
            return;
        case "stateSnapshot":
            applyStateSnapshot(payload, player);
            return;
        case "draw": applyDraw(player, payload); break;
        case "search": applySearch(player, payload); break;
        case "play": applyPlay(player, payload); break;
        case "move": applyMove(player, payload); break;
        case "flip": applyFlip(player, payload); break;
        case "handFlip": applyHandFlip(player, payload); break;
        case "rotate": applyRotate(player, payload); break;
        case "counter": applyCounter(player, payload); break;
        case "initial": applyInitial(player, payload); break;

        // 任意イベント
        case "select": applySelect(player, payload); break;
        case "endTurn": applyEndTurn(player, payload); break;
        case "shuffle": applyShuffle(player, payload); break;
        case "remove": applyRemove(player, payload); break;
        case "handRemove": applyHandRemove(player, payload); break;
        case "returnHand": applyReturnHand(player, payload); break;
        case "returnDeck": applyReturnDeck(player, payload); break;
    }

    renderAll();
}
/* =========================================================
  同期ドロー
========================================================= */
function getRemoteTarget(player) {
    return player === "user1" ? gameState.player1 : gameState.player2;
}

function getOrCreateRemoteCard(target, payload) {
    if (!target || !payload) return null;

    const cardId = payload.cardId;
    if (!cardId) return null;

    let card =
        (target.hand || []).find(c => c.instanceId === cardId) ||
        (target.deck || []).find(c => c.instanceId === cardId) ||
        (target.board || []).find(c => c.instanceId === cardId) ||
        (gameState.handCards || []).find(c => c.instanceId === cardId) ||
        (gameState.boardCards || []).find(c => c.instanceId === cardId) ||
        null;

    // イベント到着時点で相手のカードがローカルに存在しない場合、
    // イベント自身に含めたカード情報から復元する。
    if (!card && payload.card) {
        card = JSON.parse(JSON.stringify(payload.card));
    }

    return card;
}

function removeCardEverywhere(target, cardId) {
    if (!target) return;

    target.deck = (target.deck || []).filter(c => c.instanceId !== cardId);
    target.hand = (target.hand || []).filter(c => c.instanceId !== cardId);
    target.board = (target.board || []).filter(c => c.instanceId !== cardId);

    gameState.boardCards = (gameState.boardCards || []).filter(c => c.instanceId !== cardId);
    gameState.handCards = (gameState.handCards || []).filter(c => c.instanceId !== cardId);
}

/* =========================================================
  同期ドロー
========================================================= */
function applyDraw(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    target.deck = (target.deck || []).filter(c => c.instanceId !== payload.cardId);
    target.board = (target.board || []).filter(c => c.instanceId !== payload.cardId);

    card.faceDown = !!payload.faceDown;

    if (!target.hand.some(c => c.instanceId === payload.cardId)) {
        target.hand.push(card);
    }

    gameState.handCards = gameState.handCards.filter(c => c.instanceId !== payload.cardId);
    gameState.handCards.push(card);
}

/* =========================================================
  同期カード移動
========================================================= */
function applyPlay(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    removeCardEverywhere(target, payload.cardId);
    target.board.push(card);

    card.x = Number(payload.x ?? card.x ?? 0);
    card.y = Number(payload.y ?? card.y ?? 0);
    card.faceDown = !!payload.faceDown;

    gameState.boardCards.push(card);
}

function applyMove(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    if (!(target.board || []).some(c => c.instanceId === payload.cardId)) {
        removeCardEverywhere(target, payload.cardId);
        target.board.push(card);
    }

    card.x = Number(payload.x ?? card.x ?? 0);
    card.y = Number(payload.y ?? card.y ?? 0);

    const globalCard = gameState.boardCards.find(c => c.instanceId === payload.cardId);
    if (!globalCard) {
        gameState.boardCards.push(card);
    } else if (globalCard !== card) {
        globalCard.x = card.x;
        globalCard.y = card.y;
    }
}

/* =========================================================
  同期裏向き
========================================================= */
function applyFlip(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;

    if (!(target.board || []).some(c => c.instanceId === payload.cardId)) {
        removeCardEverywhere(target, payload.cardId);
        target.board.push(card);
    }

    card.faceDown = !!payload.faceDown;

    const globalCard = gameState.boardCards.find(c => c.instanceId === payload.cardId);
    if (globalCard && globalCard !== card) {
        globalCard.faceDown = card.faceDown;
    } else if (!globalCard) {
        gameState.boardCards.push(card);
    }
}

/* =========================================================
  同期回転
========================================================= */
function applyRotate(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    targetCard.rotated = !!(payload.card ? (payload.card.rotated ?? payload.card.rotation) : (payload.rotated ?? payload.rotation));
    targetCard.rotation = targetCard.rotated;

    let globalCard = (gameState.boardCards || []).find(c => c.instanceId === cardId);
    if (!globalCard) {
        globalCard = JSON.parse(JSON.stringify(targetCard));
        gameState.boardCards.push(globalCard);
    } else {
        globalCard.rotated = targetCard.rotated;
        globalCard.rotation = targetCard.rotation;
    }
}

/* =========================================================
  同期カウンター
========================================================= */
function applyCounter(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;

    const cardId = payload?.cardId;
    if (!cardId) return;

    let targetCard = (target.board || []).find(c => c.instanceId === cardId);
    if (!targetCard && payload.card) {
        targetCard = JSON.parse(JSON.stringify(payload.card));
        target.board = target.board || [];
        target.board.push(targetCard);
    }
    if (!targetCard) return;

    if (payload.card && payload.card.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.card.counters));
    } else if (payload.counters) {
        targetCard.counters = JSON.parse(JSON.stringify(payload.counters));
    } else {
        targetCard.counters = targetCard.counters || {};
        const type = payload.color;
        targetCard.counters[type] = Number(targetCard.counters[type] || 0) + Number(payload.value || 0);
    }

    updateCounterEverywhere(cardId, targetCard.counters);

    // 相手側配列を表示元にして盤面配列を再構築
    gameState.boardCards = [
        ...(gameState.player1?.board || []),
        ...(gameState.player2?.board || [])
    ];
}
function applyInitial(player, payload) {
    const target = getRemoteTarget(player);
    if (!target || !payload?.cardId) return;

    // 同じ初期配置イベントが複数回届いても、同一instanceIdは1枚だけにする。
    let card = getOrCreateRemoteCard(target, payload);
    if (!card && payload.card) {
        card = JSON.parse(JSON.stringify(payload.card));
    }
    if (!card) return;

    removeCardEverywhere(target, payload.cardId);

    card.instanceId = payload.cardId;
    card.owner = card.owner || player;
    card.x = Number(payload.x ?? card.x ?? 0);
    card.y = Number(payload.y ?? card.y ?? 0);
    card.faceDown = !!payload.faceDown;

    target.board.push(card);
    rebuildBoardCardsUnique();
}

/* =========================================================
   同期PP
========================================================= */





/* =========================================================
   グローバル変数
========================================================= */
let cardDatabase = [];
let cardDatabaseLoaded = false;
let currentRole = null;
let gameState = {
    role: null,
    selectedCardId: null,
    nextCardId: 1,
    boardCards: [],
    handCards: [],
    pp: Array(20).fill(0),
    history: [],
    logs: [],
    logEventIds: []
};
let contextTargetCardId = null;

/* =========================================================
   カウンターとステータスの対応
========================================================= */
const COUNTER_TYPES = {
    green: {
        name: "緑",
        stat: "hp"
    },
    red: {
        name: "赤",
        stat: "attack"
    },
    white: {
        name: "白",
        stat: "defense"
    },
    blue: {
        name: "青",
        stat: "magic"
    },
    yellow: {
        name: "黄",
        stat: "resistance"
    }
};

/* =========================================================
   トークン召喚設定
   ※ cardIds に召喚候補となるカードIDを登録してください。
   トークン召喚時に画像を見て候補から1枚選択し、盤面へ配置します。
========================================================= */
const TOKEN_SUMMON_GROUPS = [
    {
        name: "トークン",
        cardIds: ["6001", "2001"]
    }
];


/* =========================================================
   v7追加UIスタイル
========================================================= */
function injectV7Styles() {
    if (document.getElementById("v7-online-sync-styles")) return;
    const style = document.createElement("style"); style.id = "v7-online-sync-styles";
    style.textContent = `#deck{position:relative}.deck-zone{position:relative}.deck-search-button{display:block;position:absolute;left:calc(50% + 80px);top:84px;transform:translateY(-50%);width:112px;box-sizing:border-box;margin:0;padding:8px 10px;cursor:pointer;z-index:20;border:1px solid #555555;border-radius:6px;background:#303030;color:#ffffff;font-size:14px;line-height:1.4;text-align:center;white-space:nowrap}.deck-search-button:hover{background:#414141}#deck-search-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}.deck-search-panel{width:min(720px,90vw);max-height:85vh;overflow:auto;background:#fff;border-radius:10px;padding:16px;box-sizing:border-box}.deck-search-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.deck-search-panel input{width:100%;box-sizing:border-box;padding:9px;margin-bottom:10px}.deck-search-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}.deck-search-card{display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px;cursor:pointer;background:#fff;border:1px solid #ccc;border-radius:6px}.deck-search-card img{width:90px;height:126px;object-fit:contain}.deck-search-card span{font-size:12px;text-align:center}`;
    document.head.appendChild(style);
}

/* =========================================================
   初期化
========================================================= */
document.addEventListener(
    "DOMContentLoaded",
    () => {
        setupHomeButtons();
        setupGameButtons();
        setupContextMenu();
        setupPP();
        injectV7Styles();
        setupDeckSearch();
        document.addEventListener(
            "click",
            handleDocumentClick
        );
        console.log(
            "My TCG Simulator 起動"
        );    });

/* =========================
   対面
========================= */
function getMyPlayerState() {

    if (currentRole === "user1") {
        return gameState.player1;
    }

    if (currentRole === "user2") {
        return gameState.player2;
    }

    return null;
}


function getOpponentPlayerState() {

    if (currentRole === "user1") {
        return gameState.player2;
    }

    if (currentRole === "user2") {
        return gameState.player1;
    }

    return null;
}

/* =========================================================
   ゲーム開始
========================================================= */
async function startGame(role) {

    console.log("ゲーム開始:", role);

    /* ---------------------------------------------------------
       カードDB読み込み
    --------------------------------------------------------- */
    const loaded = await loadCardDatabase();

    if (!loaded) {
        console.error("カードDBの読み込みに失敗しました。");
        alert("カードデータの読み込みに失敗しました。");
        return;
    }

    /* ---------------------------------------------------------
       デッキコード取得
    --------------------------------------------------------- */
    const deckCode = (gameState.deckCode || "").trim();

    console.log("デッキコード:", deckCode);

    if (role !== "spectator" && !deckCode) {
        alert("デッキコードが入力されていません。");
        return;
    }

    currentRole = role;
    document.body.classList.toggle("spectator-mode", role === "spectator");

    /* ---------------------------------------------------------
       ゲーム状態を初期化
    --------------------------------------------------------- */
    gameState = {
        player1: {
            deck: [],
            hand: [],
            board: []
        },

        player2: {
            deck: [],
            hand: [],
            board: []
        },

        role: role,
        selectedCardId: null,
        nextCardId: 1,

        boardCards: [],
        handCards: [],

        pp: Array(20).fill(0),

        history: [],
        logs: [],

        deckCode: role === "spectator" ? "" : deckCode
    };

    /*
       startGame() 内で gameState を作り直しているので、
       デバッグ用の window.gameState も更新する
    */
    window.gameState = gameState;

    /* ---------------------------------------------------------
       デッキ構築
    --------------------------------------------------------- */

    let deck = [];
    if (role !== "spectator") {
        deck = buildDeckFromCode(deckCode);

        console.log("生成されたデッキ枚数:", deck.length);

        if (deck.length === 0) {
            alert(
                "デッキを作成できませんでした。\n" +
                "デッキコードまたはカードIDを確認してください。"
            );
            return;
        }

        if (role === "user1") {
            gameState.player1.deck = deck;
        } else if (role === "user2") {
            gameState.player2.deck = deck;
        }
    } else {
        console.log("観戦モード: デッキコードなしで1P/2Pの状態を待機します。");
    }

    /* ---------------------------------------------------------
       ★ 先にゲーム画面へ移動
       
       初期配置カード選択UIがゲーム画面内にある場合、
       これを先に実行しないと選択画面が見えない。
    --------------------------------------------------------- */

    showGameScreen();

    /* ---------------------------------------------------------
       現在のプレイヤーのデッキを取得
    --------------------------------------------------------- */

    let player = null;

    if (role === "user1") {
        player = gameState.player1;
    } else if (role === "user2") {
        player = gameState.player2;
    }

    /* ---------------------------------------------------------
       WebSocket接続（初期イベント送信より前）
    --------------------------------------------------------- */
    try {
        await connectWebSocket();
    } catch (error) {
        console.warn("WebSocket接続に失敗しました。", error);
    }

    /* ---------------------------------------------------------
       初期配置カードを1枚選択
    --------------------------------------------------------- */

    if (player) {

        console.log(
            "初期配置カードを選択します。デッキ枚数:",
            player.deck.length
        );

        const initialCard = await selectInitialCard();

        /* -----------------------------------------------------
           初期配置カードを盤面へ
        ----------------------------------------------------- */

        if (initialCard) {

            console.log(
                "初期配置カード:",
                initialCard
            );
            initialCard.x = 350;
            initialCard.y = 600;

            player.board.push(initialCard);

            /*
               全体盤面管理にも登録
            */
            rebuildBoardCardsUnique();

            sendGameEvent("initial", {
                cardId: initialCard.instanceId,
                x: initialCard.x,
                y: initialCard.y,
                faceDown: !!initialCard.faceDown,
                card: JSON.parse(JSON.stringify(initialCard))
            });

        } else {

            console.warn(
                "初期配置カードが選択されませんでした。"
            );
        }

        /* -----------------------------------------------------
           残りのデッキをシャッフル
        ----------------------------------------------------- */

        shuffle(player.deck);

        console.log(
            "シャッフル後のデッキ枚数:",
            player.deck.length
        );

        /* -----------------------------------------------------
           5枚ドロー
        ----------------------------------------------------- */

        const drawCount = Math.min(
            5,
            player.deck.length
        );

        for (let i = 0; i < drawCount; i++) {

            const card = player.deck.pop();

            if (!card) {
                break;
            }

            player.hand.push(card);

            /*
               全体手札管理にも登録
            */
            gameState.handCards.push(card);

            sendGameEvent("draw", {
                cardId: card.instanceId,
                faceDown: !!card.faceDown,
                card: JSON.parse(JSON.stringify(card))
            });

            addLog(`${getRoleName(currentRole)}がカードをドローしました`);
        }

        console.log(
            "初期手札:",
            player.hand
        );

        console.log(
            "残りデッキ:",
            player.deck.length
        );
    }

    /* ---------------------------------------------------------
       画面を再描画
    --------------------------------------------------------- */

    renderAll();

    // 初期配置・初期手札・シャッフル後のデッキ順を相手へまとめて同期
    sendStateSnapshot();

    console.log("ゲーム開始処理完了");
}

/* =========================================================
   My TCG Simulator
   script.js
========================================================= */
// WebSocket 接続（Render の URLを後で入れる）
let ws = null;

function connectWebSocket() {
    return new Promise((resolve) => {
        let settled = false;

        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        try {
            ws = new WebSocket("wss://ctcg-ws-server.onrender.com");
        } catch (error) {
            console.error("WebSocket生成エラー:", error);
            finish();
            return;
        }

        const timeoutId = setTimeout(() => {
            if (!settled) {
                console.warn("WebSocket接続がタイムアウトしました。ゲームはオフライン状態で開始します。");
                finish();
            }
        }, 5000);

        ws.onopen = () => {
            clearTimeout(timeoutId);
            addLog("オンライン対戦サーバーに接続しました。");
            console.log("WebSocket OPEN");
            sendGameEvent("stateRequest", {});
            if (currentRole === "spectator") {
                setTimeout(() => sendGameEvent("stateRequest", {}), 1000);
                setTimeout(() => sendGameEvent("stateRequest", {}), 3000);
                setTimeout(() => sendGameEvent("stateRequest", {}), 6000);
            }
            finish();
        };

        ws.onmessage = async (msg) => {
            try {
                let raw = msg.data;

                if (raw instanceof Blob) {
                    raw = await raw.text();
                } else if (raw instanceof ArrayBuffer) {
                    raw = new TextDecoder().decode(raw);
                } else if (ArrayBuffer.isView(raw)) {
                    raw = new TextDecoder().decode(raw);
                }

                if (typeof raw !== "string") raw = String(raw);

                const event = JSON.parse(raw);
                console.log("同期受信:", event);
                applyGameEvent(event);
            } catch (error) {
                console.error("同期データの解析に失敗:", error, msg.data);
            }
        };

        ws.onclose = () => {
            clearTimeout(timeoutId);
            addLog("サーバーとの接続が切れました。");
        };

        ws.onerror = (err) => {
            clearTimeout(timeoutId);
            console.error("WebSocket error:", err);
            finish();
        };
    });
}

function sendGameEvent(type, payload = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket が接続されていません");
        return;
    }

    const event = {
        type: type,
        player: currentRole,
        payload: payload
    };

    ws.send(JSON.stringify(event));
}

/* =========================================================
   初期配置カード選択
========================================================= */
function selectInitialCard() {
    return new Promise((resolve) => {
        const overlay = document.getElementById("initial-card-overlay");
        const cardList = document.getElementById("initial-card-list");
        const selectedLabel = document.getElementById("initial-card-selected-label");
        const confirmButton = document.getElementById("initial-card-confirm-button");

        if (!overlay || !cardList || !selectedLabel || !confirmButton) {
            console.warn("初期配置カード選択UIが見つかりません。");
            resolve(null);
            return;
        }

        cardList.innerHTML = "";
        selectedLabel.textContent = "カードを選択してください";
        confirmButton.disabled = true;

        let selectedCard = null;

        // ★ プレイヤーのデッキそのもの
        const deck =
            (currentRole === "user1")
                ? gameState.player1.deck
                : gameState.player2.deck;

        // ★ デッキのカードをそのまま一覧にする
        for (const card of deck) {

            const item = document.createElement("div");
            item.className = "initial-card-item";
            item.dataset.instanceId = card.instanceId;

            const image = document.createElement("img");
            image.src = getCardImage(card);
            image.alt = getCardLabel(card);
            item.appendChild(image);

            item.addEventListener("click", () => {
                const previous = cardList.querySelector(".initial-card-item.selected");
                if (previous) previous.classList.remove("selected");

                item.classList.add("selected");
                selectedCard = card;
                selectedLabel.textContent = getCardLabel(card);
                confirmButton.disabled = false;
            });

            cardList.appendChild(item);
        }

        confirmButton.onclick = () => {
            if (!selectedCard) return;

            const index = deck.findIndex(
                c => c.instanceId === selectedCard.instanceId
            );

            if (index !== -1) {
                deck.splice(index, 1); // ★ 正しく抜ける
            }

            overlay.style.display = "none";
            resolve(selectedCard);
        };

        overlay.style.display = "flex";
    });
}



/* =========================================================
   シャッフル関数（グローバル）
========================================================= */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


/* =========================================================
   JSONカードデータ読み込み
========================================================= */
async function loadCardDatabase() {
    if (cardDatabaseLoaded) {
        return true;
    }
    try {
        const response =
            await fetch(
                "./data/cardsID.json"
            );
        if (!response.ok) {
            throw new Error(
                `カードデータの読み込みに失敗しました: HTTP ${response.status}`
            );
        }
        const data =
            await response.json();
        if (!Array.isArray(data)) {
            throw new Error(
                "cardsID.jsonの形式が正しくありません。"
            );
        }

        cardDatabase =
            data;
        cardDatabaseLoaded =
            true;
        console.log(
            "カードデータを読み込みました:",
            cardDatabase
        );
        return true;
    } catch (error) {
        console.error(
            "カード読み込みエラー:",
            error
        );
        alert(
            "カードデータの読み込みに失敗しました。\n\n" +
            error.message
        );
        return false;
    }
}
/* =========================================================
   画面切り替え
========================================================= */
function showGameScreen() {
    const homeScreen =
        document.getElementById(
            "home-screen"
        );
    const gameScreen =
        document.getElementById(
            "game-screen"
        );
    if (homeScreen) {
        homeScreen.classList.remove(
            "active"
        );
    }
    if (gameScreen) {
        gameScreen.classList.add(
            "active"
        );    }    }
/* =========================================================
   ゲームボタン
========================================================= */
function setupGameButtons() {
    const homeButton =
        document.getElementById(
            "home-button"
        );
        const diceButton =
        document.getElementById(
            "dice-button"
        );
    const tokenSummonButton =
        document.getElementById(
            "token-summon-button"
        );
    const undoButton =
        document.getElementById(
            "undo-button"
        );
    const drawButton =
        document.getElementById(
            "draw-button"
        );
    const drawHiddenButton =
        document.getElementById(
            "draw-hidden-button"
        );
    const shuffleButton =
        document.getElementById(
            "shuffle-deck-button"
        );
    if (homeButton) {
        homeButton.addEventListener(
            "click",
            () => {
                showHomeScreen();
            }        );    }
    if (diceButton) {
        diceButton.addEventListener(
            "click",
            () => {
                rollDice();
            }        );    }
    if (tokenSummonButton) {
        tokenSummonButton.addEventListener(
            "click",
            () => {
                summonTokenGroup();
            }
        );
    }
    if (undoButton) {
        undoButton.addEventListener(
            "click",
            () => {
                undo();            }
        );    }
    if (drawButton) {
        drawButton.addEventListener(
            "click",
            () => {
                drawCard(false);
            }        );    }
    if (drawHiddenButton) {
        drawHiddenButton.addEventListener(
            "click",
            () => {
                drawCard(true);
            }        );    }
    if (shuffleButton) {
        shuffleButton.addEventListener(
            "click",
            () => {
                shuffleDeck();
            }        );    }
}
/* =========================================================
   ホームへ戻る
========================================================= */
function showHomeScreen() {

    document.body.classList.remove("spectator-mode");

    const homeScreen =
        document.getElementById("home-screen");

    const gameScreen =
        document.getElementById("game-screen");

    const deckBuilderScreen =
        document.getElementById("deck-builder-screen");

    const infoScreen =
        document.getElementById("info-screen");


    // すべての画面を非表示
    if (homeScreen) {
        homeScreen.classList.remove("active");
    }

    if (gameScreen) {
        gameScreen.classList.remove("active");
    }

    if (deckBuilderScreen) {
        deckBuilderScreen.classList.remove("active");
    }

    if (infoScreen) {
        infoScreen.classList.remove("active");
    }


    // ホームだけ表示
    if (homeScreen) {
        homeScreen.classList.add("active");
    }
}

/* =========================================================
   全体再描画
========================================================= */

function renderAll() {

    renderBoard();

    renderHand();

    renderPP();

    renderSelectedCardDetail();

    renderLogs();
}


/* =========================================================
   手札を描画
========================================================= */

function renderHand() {

    const handElement =
        document.getElementById("hand");

    if (!handElement) {
        return;
    }

    handElement.innerHTML = "";


    // =====================================================
    // 現在のプレイヤーの手札を選ぶ
    // =====================================================

    // プレイヤーは自分の手札のみ。観戦者は1P/2Pの手札を両方表示する。
    if (currentRole === "spectator") {
        renderSpectatorHands();
        return;
    }

    let handCards = [];

    if (currentRole === "user1") {
        handCards = gameState.player1.hand || [];
    } else if (currentRole === "user2") {
        handCards = gameState.player2.hand || [];
    } else {
        return;
    }

    // =====================================================
    // 手札を描画
    // =====================================================

    handCards.forEach(card => {

        const cardElement =
            document.createElement("div");

        cardElement.className =
            "hand-card";

        cardElement.draggable =
            true;


        // =================================================
        // 裏向き
        // =================================================

        if (card.faceDown) {

            cardElement.classList.add(
                "face-down"
            );
        }


        // =================================================
        // カード画像
        // =================================================

        const image =
            document.createElement("img");

        image.src =
            getCardImage(card);

        image.alt =
            getCardLabel(card);

        cardElement.appendChild(
            image
        );


        // =================================================
        // インスタンスID
        // =================================================

        cardElement.dataset.instanceId =
            card.instanceId;


        // =================================================
        // 左クリック＝選択
        // =================================================

        cardElement.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                // 裏向きカードは選択・詳細表示しない
                if (card.faceDown) {
                    return;
                }

                selectCard(
                    card.instanceId
                );
            }
        );


        // =================================================
        // 右クリック＝裏向き切り替え
        // =================================================

        cardElement.addEventListener(
            "contextmenu",
            event => {

                event.preventDefault();

                card.faceDown =
                    !card.faceDown;

                // 選択中だった場合は解除
                if (
                    card.faceDown &&
                    gameState.selectedCardId ===
                        card.instanceId
                ) {

                    gameState.selectedCardId =
                        null;
                }

                renderHand();
            }
        );


        // =================================================
        // ドラッグ開始
        // =================================================

        cardElement.addEventListener(
            "dragstart",
            event => {

                event.dataTransfer.setData(
                    "text/plain",
                    card.instanceId
                );

                event.dataTransfer.effectAllowed =
                    "move";
            }
        );


        handElement.appendChild(
            cardElement
        );
    });


    // =====================================================
    // 手札へのドロップ処理
    // =====================================================

    setupHandDrop();
    renderPP();
    renderSelectedCardDetail();
    renderLogs();
}

/* =========================================================
   観戦者用：1P/2Pの手札を両方表示
========================================================= */
function renderSpectatorHands() {
    const handElement = document.getElementById("hand");
    if (!handElement) return;
    handElement.innerHTML = "";

    const renderPlayerHand = (playerKey, label) => {
        const player = gameState[playerKey] || { hand: [] };
        const section = document.createElement("div");
        section.className = "spectator-hand-section";

        const title = document.createElement("div");
        title.className = "spectator-hand-title";
        title.textContent = label;
        section.appendChild(title);

        const cards = document.createElement("div");
        cards.className = "spectator-hand-cards";
        (player.hand || []).forEach(card => {
            const cardElement = document.createElement("div");
            cardElement.className = "hand-card spectator-hand-card";
            const image = document.createElement("img");
            image.src = getCardImage(card);
            image.alt = getCardLabel(card);
            cardElement.appendChild(image);
            cards.appendChild(cardElement);
        });
        if (!(player.hand || []).length) {
            const empty = document.createElement("div");
            empty.className = "spectator-hand-empty";
            empty.textContent = "手札なし";
            cards.appendChild(empty);
        }
        section.appendChild(cards);
        handElement.appendChild(section);
    };

    renderPlayerHand("player1", "1P 手札");
    renderPlayerHand("player2", "2P 手札");
}

/* =========================================================
   ゲーム用カード作成
========================================================= */
function createCardData(cardInfo) {
    const card = {
        // クライアントをまたいでも衝突しない一意ID
        instanceId: (() => {
            const owner = currentRole || "local";
            const uuid = (typeof crypto !== "undefined" && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return `card-${owner}-${uuid}`;
        })(),
        owner:

            currentRole || "unknown",

        cardId:

            String(cardInfo.id ?? ""),
        image:
            cardInfo.image ?? "",
        type:
            cardInfo.type ?? "normal",
        baseStats: {
            hp:
                Number(cardInfo.hp ?? 0),
            attack:
                Number(cardInfo.attack ?? 0),
            defense:
               Number(cardInfo.defense ?? 0),
           magic:
                Number(cardInfo.magic ?? 0),
            resistance:
                Number(cardInfo.resistance ?? 0)
        },
        counters: {
            green: 0,
            red: 0,
            white: 0,
            blue: 0,
            yellow: 0        
        },
        faceDown: false,
        rotated: false,
        x: 100,
        y: 100
    };

    return card;
}

/* =========================================================
   カード名
========================================================= */
function getCardLabel(card) {
    if (!card) {
        return "カード";
    }
    if (card.name) {
        return card.name;
    }
    if (card.cardId) {
        return `カード${card.cardId}`;
    }
    return "カード";
}

/* =========================================================
   カード画像
========================================================= */
function getCardImage(card) {
    if (!card) {
        return "";
    }
    return card.image || "";}
/* =========================================================
   ステータスカード判定
========================================================= */
function hasStats(card) {
    if (!card) {
        return false;
    }
    return (
        card.type === "adventurer" ||
        card.type === "monster"
    );}
/* =========================================================
   ボードカード検索
========================================================= */
function findCard(instanceId) {

    // ★ 現在のプレイヤーの手札と盤面を参照
    const hand =
        (currentRole === "user1")
            ? gameState.player1.hand
            : gameState.player2.hand;

    const board =
        (currentRole === "user1")
            ? gameState.player1.board
            : gameState.player2.board;

    // ★ 手札 → 盤面の順で探す
    return (
        hand.find(c => c.instanceId === instanceId) ||
        board.find(c => c.instanceId === instanceId) ||
        null
    );
}
function selectCard(instanceId) {
    let card = findCard(instanceId);
    if (!card) {
        return;
    }
    gameState.selectedCardId = instanceId;
    renderBoard();
    renderHand();
    renderSelectedCardDetail();
}

/* =========================================================
   カウンター補正
========================================================= */

function getCounterBonus(
    card,
    statName
) {

    if (!card) {
        return 0;
    }
    let bonus = 0;
    for (
        const [counterType, data]
        of Object.entries(COUNTER_TYPES)
    ) {

        if (data.stat === statName) {

            bonus +=
                Number(
                    (card.counters || {})[counterType] || 0
                );
        }
    }
    return bonus;
}

/* =========================================================
   現在ステータス
========================================================= */

function getCurrentStat(
    card,
    statName
) {

    if (!card) {
        return 0;
    }


    const base =
        Number(
            card.baseStats[statName] || 0
        );


    const bonus =
        getCounterBonus(
            card,
            statName
        );


    return base + bonus;

}


/* =========================================================
   ボード描画
========================================================= */

function getCardOwner(card) {
    if (!card) return null;
    if (card.owner) return card.owner;
    const id = String(card.instanceId || "");
    if (id.includes("card-user1-")) return "user1";
    if (id.includes("card-user2-")) return "user2";
    return null;
}

function rebuildBoardCardsUnique() {
    const seen = new Set();
    const merged = [];
    const add = card => {
        if (!card || !card.instanceId || seen.has(card.instanceId)) return;
        seen.add(card.instanceId);
        merged.push(card);
    };
    (gameState.player1?.board || []).forEach(add);
    (gameState.player2?.board || []).forEach(add);
    gameState.boardCards = merged;
    return merged;
}

function renderBoard() {

    const boardCardsElement =
        document.getElementById("board-cards");

    if (!boardCardsElement) {
        return;
    }

    boardCardsElement.innerHTML = "";

    const board = rebuildBoardCardsUnique();

    board.forEach(card => {
       
            const cardElement =
                document.createElement(
                    "div"
                );

            cardElement.className =
                "board-card";

            cardElement.dataset.instanceId =
                card.instanceId;

            if (
                gameState.selectedCardId ===
                card.instanceId
            ) {
                cardElement.classList.add(
                    "selected"
                );
            }

            if (card.faceDown) {
                cardElement.classList.add(
                    "face-down"
                );
            }

            if (card.rotated) {
                cardElement.classList.add(
                    "rotated"
                );
            }

            const owner = getCardOwner(card);
            // 観戦者は1P側を正位置、2P側を対面位置として表示する。
            const isOpponent = currentRole === "user1"
                ? owner === "user2"
                : currentRole === "user2"
                    ? owner === "user1"
                    : owner === "user2";
            const boardElement = document.getElementById("board");

            // 相手カードは「ボード中央」を軸に180度の鏡写しにする。
            // ボード背景画像のサイズが変わっても、実際のボード寸法を基準にする。
            const boardWidth = boardElement ? boardElement.clientWidth : 800;
            const boardHeight = boardElement ? boardElement.clientHeight : 800;
            const computedCardStyle = getComputedStyle(cardElement);
            const cardWidth = parseFloat(computedCardStyle.width) || 90;
            const cardHeight = parseFloat(computedCardStyle.height) || 126;

            const sourceX = Number(card.x || 0);
            const sourceY = Number(card.y || 0);

            const displayX = isOpponent
                ? boardWidth - sourceX - cardWidth
                : sourceX;

            const displayY = isOpponent
                ? boardHeight - sourceY - cardHeight + 25
                : sourceY;

            cardElement.style.left = `${displayX}px`;
            cardElement.style.top = `${displayY}px`;

            const localRotation = card.rotated ? 90 : 0;
            const facingRotation = isOpponent ? 180 : 0;
            cardElement.style.setProperty(
                "transform",
                `rotate(${facingRotation + localRotation}deg)`,
                "important"
            );
            cardElement.style.transformOrigin = "center center";
            /* =========================
               画像
            ========================== */
            const image =
                document.createElement(
                    "img"
                );
            image.className =
                "board-card-image";
            image.src =
                getCardImage(card);
            image.alt =
                getCardLabel(card);
            cardElement.appendChild(
                image
            );


            /* =========================
               ステータス
            ========================== */

            if (
                hasStats(card) &&
                !card.faceDown
            ) {

                const stats =
                    createBoardStatsElement(
                        card
                    );


                cardElement.appendChild(
                    stats
                );

            }


            /* =========================
               カウンター
            ========================== */

            const counters =
                createCounterDisplay(
                    card
                );


            cardElement.appendChild(
                counters
            );



          /* =========================
   左クリック＝選択
========================== */

let lastClickTime = 0;

            cardElement.addEventListener("click", event => {
                event.stopPropagation();
                const now = Date.now();

                if (now - lastClickTime < 350) {
                    lastClickTime = 0;
                    rotateCard(card.instanceId);
                    return;
                }

                lastClickTime = now;
                setTimeout(() => {
                    if (lastClickTime === now) {
                        lastClickTime = 0;
                        if (!card.faceDown) {
                            selectCard(card.instanceId);
                        }
                    }
                }, 360);
            });

            cardElement.addEventListener("dblclick", event => {
                event.preventDefault();
                event.stopPropagation();
                lastClickTime = 0;
                rotateCard(card.instanceId);
            });

            /* =========================
               右クリック
            ========================== */

            cardElement.addEventListener(
                "contextmenu",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    selectCard(
                        card.instanceId
                    );


                    openContextMenu(
                        event.clientX,
                        event.clientY,
                        card.instanceId
                    );

                }
            );


            /* =========================
               ドラッグ
            ========================== */

            setupBoardCardDrag(
                cardElement,
                card
            );


            boardCardsElement.appendChild(
                cardElement
            );

        }
    );

}


/* =========================================================
   ボード上ステータス表示
========================================================= */

function createBoardStatsElement(
    card
) {

    const stats =
        document.createElement(
            "div"
        );


    stats.className =
        "card-stats";


    const statList = [

        ["HP", "hp"],
        ["打", "attack"],
        ["守", "defense"],
        ["魔", "magic"],
        ["抵", "resistance"]

    ];


    statList.forEach(
        ([label, statName]) => {

            const stat =
                document.createElement(
                    "div"
                );


            stat.className =
                "card-stat";


            const labelElement =
                document.createElement(
                    "span"
                );


            labelElement.className =
                "card-stat-label";


            labelElement.textContent =
                label;


            const valueElement =
                document.createElement(
                    "span"
                );


            valueElement.className =
                "card-stat-value";


            valueElement.textContent =
                getCurrentStat(
                    card,
                    statName
                );


            stat.appendChild(
                labelElement
            );

            stat.appendChild(
                valueElement
            );


            stats.appendChild(
                stat
            );

        }
    );


    return stats;

}


/* =========================================================
   カウンター表示
========================================================= */

function createCounterDisplay(
    card
) {

    const container =
        document.createElement(
            "div"
        );


    container.className =
        "card-counters";


    for (
        const counterType of
        Object.keys(COUNTER_TYPES)
    ) {

        const count =
            Number(
                (card.counters || {})[counterType] || 0
            );


        /*
            0の場合は表示しない。

            正の数：
            通常のおはじき

            負の数：
            -1、-2などを表示
        */

        if (count === 0) {
            continue;
        }


        const counter =
            document.createElement(
                "div"
            );


        counter.className =
            `card-counter counter-${counterType}`;


        counter.textContent =
            count;


        container.appendChild(
            counter
        );

    }


    return container;

}





/* =========================================================
   選択解除
========================================================= */

function clearCardSelection() {

    gameState.selectedCardId =
        null;


    renderBoard();

    renderSelectedCardDetail();

}


/* =========================================================
   ダブルクリックで横向き
========================================================= */

function rotateCard(instanceId) {
    const card = findBoardCard(instanceId);
    if (!card) return;

    saveHistory();

    // 回転状態を必ず boolean で保持
    card.rotated = !Boolean(card.rotated);
    card.rotation = card.rotated;

    // player1 / player2 側に別オブジェクトが存在する場合も同期
    updateRotationEverywhere(card.instanceId, card.rotated);

    const payloadCard = JSON.parse(JSON.stringify(card));
    sendGameEvent("rotate", {
        cardId: card.instanceId,
        rotation: card.rotated,
        rotated: card.rotated,
        card: payloadCard
    });

    addLog(
        `${getCardLabel(card)}を${card.rotated ? "横向き" : "縦向き"}にしました。`
    );

    renderAll();
    sendStateSnapshot();
}

function updateRotationEverywhere(instanceId, rotated) {
    const apply = list => {
        if (!Array.isArray(list)) return;
        const target = list.find(c => c.instanceId === instanceId);
        if (target) {
            target.rotated = Boolean(rotated);
            target.rotation = Boolean(rotated);
        }
    };
    apply(gameState.boardCards);
    apply(gameState.player1?.board);
    apply(gameState.player2?.board);
}

/* =========================================================
   ボードカード検索
========================================================= */

function findBoardCard(instanceId) {
    return gameState.boardCards.find(c => c.instanceId === instanceId) || null;
}

/* =========================================================
   ボードカードドラッグ
========================================================= */

function setupBoardCardDrag(element, card) {

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    element.addEventListener("mousedown", event => {
        if (event.button !== 0) return;

        // ダブルクリックはドラッグ開始より先に回転処理へ渡す
        if (event.detail >= 2) {
            event.preventDefault();
            return;
        }

        const board = document.getElementById("board");
        if (!board) return;

        const boardRect = board.getBoundingClientRect();

        offsetX = event.clientX - boardRect.left - card.x;
        offsetY = event.clientY - boardRect.top - card.y;

        dragging = true;
        element.classList.add("dragging");

        saveHistory();
        event.preventDefault();
    });

    document.addEventListener("mousemove", event => {
        if (!dragging) return;

        const board = document.getElementById("board");
        if (!board) return;

        const boardRect = board.getBoundingClientRect();

        card.x = event.clientX - boardRect.left - offsetX;
        card.y = event.clientY - boardRect.top - offsetY;

        // 範囲制限
        card.x = Math.max(0, Math.min(card.x, board.clientWidth - 90));
        card.y = Math.max(0, Math.min(card.y, board.clientHeight - 126));

        renderBoard();
    });

    document.addEventListener("mouseup", () => {
        if (!dragging) return;

        dragging = false;
        element.classList.remove("dragging");

        // ★★★ ここがオンライン同期の本丸 ★★★
        sendGameEvent("move", {
            cardId: card.instanceId,
            x: card.x,
            y: card.y
        });
    });
}

/* =========================================================
   手札描画
========================================================= */
function renderHand() {

    const handElement = document.getElementById("hand");
    if (!handElement) return;

    handElement.innerHTML = "";

    // ★ プレイヤーごとの手札を参照
    const hand =
        (currentRole === "user1")
            ? gameState.player1.hand
            : gameState.player2.hand;

    hand.forEach(card => {

        const cardElement = document.createElement("div");
        cardElement.className = "hand-card";
        cardElement.draggable = true;

        if (card.faceDown) {
            cardElement.classList.add("face-down");
        }

        const image = document.createElement("img");
        image.src = getCardImage(card);
        image.alt = getCardLabel(card);
        cardElement.appendChild(image);

        // 左クリック＝選択
        cardElement.dataset.instanceId = card.instanceId;
        cardElement.addEventListener("click", event => {
            event.stopPropagation();
            selectCard(card.instanceId);
        });

        // 右クリック＝裏向き切り替え
        cardElement.addEventListener("contextmenu", event => {
            event.preventDefault();
            card.faceDown = !card.faceDown;

            sendGameEvent("handFlip", {
                cardId: card.instanceId,
                faceDown: !!card.faceDown,
                card: JSON.parse(JSON.stringify(card))
            });

            renderHand();
            sendStateSnapshot();
        });

        // ドラッグ
        cardElement.addEventListener("dragstart", event => {
            event.dataTransfer.setData("text/plain", card.instanceId);
            event.dataTransfer.effectAllowed = "move";
        });

        handElement.appendChild(cardElement);
    });

    setupHandDrop();
}


/* =========================================================
   手札へのドロップ
========================================================= */
function setupHandDrop() {
    const handElement =
        document.getElementById("hand");

    if (!handElement) {
        return;
    }
    if (
       handElement.dataset.dropReady === "true"
    ) {
        return;
    }

    handElement.dataset.dropReady = "true";

    // =====================================================
    // ドラッグ中
    // =====================================================

    handElement.addEventListener(
        "dragover",
        event => {

            event.preventDefault();
        }
    );


    // =====================================================
    // 手札へドロップ
    // =====================================================

    handElement.addEventListener(
        "drop",
        event => {

            event.preventDefault();


            const instanceId =
                event.dataTransfer.getData(
                    "text/plain"
                );

            if (!instanceId) {
                return;
            }


            // ★ 現在のプレイヤーを取得

            const me =
                getMyPlayerState();

            if (!me) {
                return;
            }


            // ★ 自分の盤面から探す

            const cardIndex =
                me.board.findIndex(
                    card =>
                        card.instanceId ===
                        instanceId
                );


            if (cardIndex === -1) {
                return;
            }


            saveHistory();


            // ★ 盤面から手札へ移動

            const [card] =
                me.board.splice(
                    cardIndex,
                    1
                );

            me.hand.push(card);


            // 選択解除

            if (
                gameState.selectedCardId ===
                instanceId
            ) {

                gameState.selectedCardId =
                    null;
            }


            addLog(
                `${getCardLabel(card)}を手札に戻しました。`
            );


            renderAll();
        }
    );
}

/* =========================================================
   ボードへのドロップ
========================================================= */

function setupBoardDrop() {

    const board = document.getElementById("board");
    if (!board) return;

    if (board.dataset.dropReady === "true") return;
    board.dataset.dropReady = "true";


    // =====================================================
    // ドラッグ中
    // =====================================================

    board.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            event.dataTransfer.dropEffect =
                "move";
        }
    );


    // =====================================================
    // ボードへドロップ
    // =====================================================

 // ドラッグ中
    board.addEventListener("dragover", event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });

    // ドロップ
    board.addEventListener("drop", event => {
        event.preventDefault();

        const instanceId = event.dataTransfer.getData("text/plain");
        if (!instanceId) return;

        const me = getMyPlayerState();
        if (!me) return;
        // 手札から探す
        const cardIndex = me.hand.findIndex(card => card.instanceId === instanceId);
        if (cardIndex === -1) return;

        saveHistory();

   // 手札 → 盤面
        const [card] = me.hand.splice(cardIndex, 1);

        // ドロップ位置計算
        const boardRect = board.getBoundingClientRect();

        card.x = event.clientX - boardRect.left - 45;
        card.y = event.clientY - boardRect.top - 63;

      // 範囲制限
        card.x = Math.max(0, Math.min(card.x, board.clientWidth - 90));
        card.y = Math.max(0, Math.min(card.y, board.clientHeight - 126));

        // 盤面へ追加
        me.board.push(card);
        gameState.boardCards = gameState.boardCards.filter(c => c.instanceId !== card.instanceId);
        gameState.boardCards.push(card);

        // ★★★ オンライン同期（play）★★★
        sendGameEvent("play", {
            cardId: card.instanceId,
            x: card.x,
            y: card.y,
            faceDown: !!card.faceDown,
            card: JSON.parse(JSON.stringify(card))
        });

        addLog(`${getCardLabel(card)}をボードに配置しました。`);

        renderAll();
    });}


/* =========================================================
   ドロー
========================================================= */
function applySearch(player, payload) {
    const target = getRemoteTarget(player);
    if (!target) return;
    const card = getOrCreateRemoteCard(target, payload);
    if (!card) return;
    removeCardEverywhere(target, payload.cardId);
    target.hand.push(card);
    card.faceDown = !!payload.faceDown;
    if (!gameState.handCards.some(c => c.instanceId === card.instanceId)) {
        gameState.handCards.push(card);
    }
}

function searchCardFromDeck(instanceId) {
    const player = getMyPlayerState();
    if (!player || !player.deck) return;
    const index = player.deck.findIndex(c => c.instanceId === instanceId);
    if (index < 0) return;
    saveHistory();
    const card = player.deck.splice(index, 1)[0];
    card.faceDown = false;
    player.hand.push(card);
    gameState.handCards = gameState.handCards.filter(c => c.instanceId !== card.instanceId);
    gameState.handCards.push(card);
    sendGameEvent("search", { cardId: card.instanceId, faceDown: false, card: JSON.parse(JSON.stringify(card)) });
    addLog(`${getCardLabel(card)}をデッキからサーチしました。`);
    renderAll();
    sendStateSnapshot();
}

function setupDeckSearch() {
    const deck = document.getElementById("deck");
    if (!deck || deck.dataset.searchReady === "true") return;
    deck.dataset.searchReady = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "デッキからサーチ";
    button.className = "deck-search-button";
    button.addEventListener("click", event => { event.stopPropagation(); openDeckSearchModal(); });
    deck.appendChild(button);
}

function openDeckSearchModal() {
    const player = getMyPlayerState();
    if (!player) return;
    let modal = document.getElementById("deck-search-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "deck-search-modal";
        modal.innerHTML = `<div class="deck-search-panel"><div class="deck-search-header"><strong>デッキからサーチ</strong><button type="button" data-close-search>閉じる</button></div><input type="text" data-search-input placeholder="カード名・カードIDで検索"><div class="deck-search-list" data-search-list></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector("[data-close-search]").addEventListener("click", () => modal.remove());
        modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
    }
    const input = modal.querySelector("[data-search-input]");
    const list = modal.querySelector("[data-search-list]");
    const renderResults = () => {
        list.innerHTML = "";
        const keyword = input.value.trim().toLowerCase();
        const cards = (player.deck || []).filter(card => {
            const data = cardDatabase.find(c => String(c.id) === String(card.cardId));
            const name = String(card.name || data?.name || "").toLowerCase();
            const id = String(card.cardId || "").toLowerCase();
            return !keyword || name.includes(keyword) || id.includes(keyword);
        });
        if (!cards.length) { list.textContent = "該当するカードがありません。"; return; }
        cards.forEach(card => {
            const data = cardDatabase.find(c => String(c.id) === String(card.cardId));
            const item = document.createElement("button");
            item.type = "button"; item.className = "deck-search-card";
            const img = document.createElement("img"); img.src = getCardImage(card) || (data ? getCardImage(data) : ""); img.alt = getCardLabel(card);
            const label = document.createElement("span"); label.textContent = `${getCardLabel(card)} (${card.cardId})`;
            item.append(img, label);
            item.addEventListener("click", () => { searchCardFromDeck(card.instanceId); modal.remove(); });
            list.appendChild(item);
        });
    };
    input.value = ""; input.oninput = renderResults; renderResults(); modal.style.display = "flex"; input.focus();
}

function drawCard(faceDown = false) {

    let deck, hand;

    // ★ 現在のプレイヤーのデッキと手札を選ぶ
    if (currentRole === "user1") {
        deck = gameState.player1.deck;
        hand = gameState.player1.hand;
    } else if (currentRole === "user2") {
        deck = gameState.player2.deck;
        hand = gameState.player2.hand;
    } else {
        addLog("観戦者はカードを引けません。");
        return;
    }

    // デッキが空
    if (!deck || deck.length === 0) {
        addLog("デッキにカードがありません。");
        return;
    }

    saveHistory();

    // デッキの一番上から1枚引く
    // startGame() と同じく末尾を「デッキの上」として扱う
    const card = deck.pop();
    if (!card) {
        addLog("カードを引けませんでした。");
        return;
    }

    // 裏向きで引く場合
    card.faceDown = faceDown;

    // ★ プレイヤーの手札に追加
    hand.push(card);

    // 全体手札管理にも登録
    gameState.handCards = gameState.handCards.filter(c => c.instanceId !== card.instanceId);
    gameState.handCards.push(card);

    // ★★★ オンライン同期（draw）★★★
    sendGameEvent("draw", {
        cardId: card.instanceId,
        faceDown: !!card.faceDown
    });

    // ログ（カードID・カード名は表示しない）
    addLog(`${getRoleName(currentRole)}がカードをドローしました`);

    // 手札を更新
    renderHand();

    // 現在のデッキ順・手札状態を相手へ確実に反映
    sendStateSnapshot();
}



/* =========================================================
   デッキシャッフル
========================================================= */

function shuffleDeck() {

    addLog(
        "デッキをシャッフルしました。"
    );

}


/* =========================================================
   デッキダブルクリック
========================================================= */

function setupDeckDoubleClick() {

    const deck =
        document.getElementById(
            "deck"
        );


    if (!deck) {
        return;
    }


    deck.addEventListener(
        "dblclick",
        () => {

            drawCard(false);

        }
    );

}


/* =========================================================
   カード詳細描画
========================================================= */

function renderSelectedCardDetail() {

    const container =
        document.getElementById(
            "selected-card-content"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        !gameState.selectedCardId
    ) {

        const message =
            document.createElement(
                "p"
            );


        message.className =
            "no-selected-card";


        message.textContent =
            "カードを選択してください";


        container.appendChild(
            message
        );


        return;

    }


    const card =
        findCard(
            gameState.selectedCardId
        );


    if (!card) {

        gameState.selectedCardId =
            null;


        const message =
            document.createElement(
                "p"
            );


        message.className =
            "no-selected-card";


        message.textContent =
            "カードを選択してください";


        container.appendChild(
            message
        );


   
    }


    /* =========================
       カード画像
    ========================== */
    const imageWrap =
        document.createElement(
            "div"
        );

    imageWrap.className =
        "selected-card-image-wrap";
   const image =
        document.createElement(
            "img"
        );

    image.className =
        "selected-card-image";
    image.src =
        getCardImage(card);
    image.alt =
        getCardLabel(card);
    if (card.faceDown) {
        image.style.visibility =
            "hidden";
        imageWrap.style.background =
            "#444444";
    }
       imageWrap.appendChild(
        image
    );

    container.appendChild(
        imageWrap
    );

    setupCardLoupe(
        imageWrap,
        image,
        card
    ); 
/* =========================================================
   カード拡大鏡
========================================================= */

function setupCardLoupe(
    imageWrap,
    image,
    card
) {

    console.log(
        "★ setupCardLoupe:",
        card
    );


    let loupe = null;
    let loupeImage = null;


    /* =========================
       拡大鏡を作る
    ========================== */

    function createLoupe() {

                if (loupe) {
            return;
        }


        loupe =
            document.createElement(
                "div"
            );

        loupe.className =
            "card-loupe";


        loupeImage =
            document.createElement(
                "img"
            );


        if (card.faceDown) {

            loupeImage.src =
                "./img/card-back.png";

        } else {

            loupeImage.src =
                getCardImage(card);

        }


        loupe.appendChild(
            loupeImage
        );


        document.body.appendChild(
            loupe
        );


         }


    /* =========================
       マウスが入った
    ========================== */

    imageWrap.addEventListener(
        "mouseenter",
        event => {


            createLoupe();


            loupe.style.display =
                "block";


            loupe.style.left =
                `${event.clientX + 20}px`;

            loupe.style.top =
                `${event.clientY + 20}px`;
        }
    );


    /* =========================
       マウス移動
    ========================== */

    imageWrap.addEventListener(
        "mousemove",
        event => {

            if (!loupe) {
                return;
            }


            const rect =
                imageWrap.getBoundingClientRect();


            const x =
                event.clientX -
                rect.left;

            const y =
                event.clientY -
                rect.top;


            const zoom = 2;


            const loupeWidth =
                loupe.offsetWidth;

            const loupeHeight =
                loupe.offsetHeight;


            loupeImage.style.width =
                `${rect.width * zoom}px`;

            loupeImage.style.height =
                `${rect.height * zoom}px`;


            const imageX =
                x * zoom;

            const imageY =
                y * zoom;


            loupeImage.style.left =
                `${loupeWidth / 2 - imageX}px`;

            loupeImage.style.top =
                `${loupeHeight / 2 - imageY}px`;


            /* =========================
               ルーペ本体の位置
            ========================== */

            const offset = -100;


            let left =
                event.clientX +
                offset;

            let top =
                event.clientY +
                offset;


            if (
                left + loupeWidth >
                window.innerWidth
            ) {

                left =
                    event.clientX -
                    loupeWidth -
                    offset;
            }


            if (
                top + loupeHeight >
                window.innerHeight
            ) {

                top =
                    event.clientY -
                    loupeHeight -
                    offset;
            }


            loupe.style.left =
                `${left}px`;

            loupe.style.top =
                `${top}px`;
        }
    );


    /* =========================
       拡大鏡を安全に消す
    ========================== */

    function hideLoupe() {

        if (!loupe) {
            return;
        }

        loupe.style.display =
            "none";
    }


    /* =========================
       マウスが出た
    ========================== */

    imageWrap.addEventListener(
        "mouseleave",
        () => {

            console.log(
                "★ 拡大鏡 mouseleave"
            );

            hideLoupe();
        }
    );


    /* =========================
       ブラウザ画面の外へ
       マウスが出た場合
    ========================== */

    document.addEventListener(
        "mouseout",
        event => {

            if (!event.relatedTarget) {

                console.log(
                    "★ 拡大鏡 画面外 強制非表示"
                );

                hideLoupe();
            }
        }
    );


    /* =========================
       ブラウザのフォーカスが
       外れた場合
    ========================== */

    window.addEventListener(
        "blur",
        () => {

            console.log(
                "★ 拡大鏡 blur 強制非表示"
            );

            hideLoupe();
        }
    );
}
    /* =========================
       ステータス
    ========================== */

    if (!hasStats(card)) {

        const note =
            document.createElement(
                "div"
            );


        note.className =
            "detail-note";


        note.textContent =
            "このカードにはステータスがありません。";


        container.appendChild(
            note
        );


        return;

    }


    const stats =
        document.createElement(
            "div"
        );


    stats.className =
        "selected-card-stats";


    const statList = [

        ["HP", "hp"],
        ["打", "attack"],
        ["守", "defense"],
        ["魔", "magic"],
        ["抵", "resistance"]

    ];


    statList.forEach(
        ([label, statName]) => {

            const editor =
                createStatEditor(
                    card,
                    label,
                    statName
                );


            stats.appendChild(
                editor
            );

        }
    );


    container.appendChild(
        stats
    );


    const note =
        document.createElement(
            "div"
        );


    note.className =
        "detail-note";


    note.textContent =
        "ステータスを変更すると、対応するおはじきが自動的に増減します。";


    container.appendChild(
        note
    );




 /* =========================================================
   ステータス編集
 ========================================================= */

function createStatEditor(
    card,
    label,
    statName
) {

    const editor =
        document.createElement(
            "div"
        );


    editor.className =
        "stat-editor";


    const labelElement =
        document.createElement(
            "label"
        );


    labelElement.textContent =
        label;


    const input =
        document.createElement(
            "input"
        );


    input.type =
        "number";


    input.step =
        "1";


input.value = getCurrentStat(card, statName);

    const current =
        document.createElement(
            "div"
        );


    current.className =
        "stat-current";


    current.innerHTML =
        `現在 <strong>${getCurrentStat(card, statName)}</strong>`;


    input.addEventListener(
        "change",
        () => {

            changeBaseStat(
                card,
                statName,
                label,
                input
            );

        }
    );


    editor.appendChild(
        labelElement
    );

    editor.appendChild(
        input
    );

    editor.appendChild(
        current
    );


    return editor;

}

/* =========================================================
   ステータス変更
========================================================= */
function changeBaseStat(card, statName, label, input) {

    // 現在値（基礎ステータス + カウンター）
    const oldValue = getCurrentStat(card, statName);
    const newValue = Number(input.value);

    if (!Number.isFinite(newValue)) {
        input.value = oldValue;
        return;
    }

    const difference = newValue - oldValue;

    if (difference !== 0) {

        saveHistory();

        // ★ カウンターだけ変更する（連動の本体）
        const counterType = getCounterTypeForStat(statName);
        if (counterType) {
            const counters = cloneCounters(card.counters);
            counters[counterType] += difference;

            // 詳細画面から変更したカウンターも盤面・相手側へ同期する
            updateCounterEverywhere(card.instanceId, counters);

            const updatedCard = findBoardCard(card.instanceId);
            if (updatedCard) {
                sendCounterUpdate(updatedCard);
            }
        }

        addLog(`${getCardLabel(card)}の${label}を${oldValue}から${newValue}に変更しました。`);
    }

    renderBoard();
    renderSelectedCardDetail();
}


/* =========================================================
   ステータスからカウンタータイプを取得
========================================================= */

function getCounterTypeForStat(
    statName
) {

    for (
        const [
            counterType,
            data
        ]
        of Object.entries(
            COUNTER_TYPES
        )
    ) {

        if (
            data.stat ===
            statName
        ) {

            return counterType;

        }

    }


    return null;

}
}

/* =========================================================
   右クリックメニュー設定
========================================================= */

function setupContextMenu() {

    const menu =
        document.getElementById(
            "context-menu"
        );


    if (!menu) {
        return;
    }


    // 古いHTMLを使っていても、右クリックメニューに
    // 「手札に戻す」「デッキに戻す」が必ず存在するようにする。
    const ensureButton = (action, label, beforeAction = null) => {
        if (menu.querySelector(`button[data-action="${action}"]`)) return;
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.textContent = label;
        const before = beforeAction
            ? menu.querySelector(`button[data-action="${beforeAction}"]`)
            : null;
        if (before) menu.insertBefore(button, before);
        else menu.appendChild(button);
    };

    ensureButton("return-hand", "手札に戻す", "level-up");
    ensureButton("return-deck", "デッキに戻す", "stack");

    const buttons =
        menu.querySelectorAll(
            "button[data-action]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const action =
                        button.dataset.action;
                    executeContextAction(
                        action
                    );
                    closeContextMenu();

                }            );       }    );}


/* =========================================================
   右クリックメニューを開く
========================================================= */

function openContextMenu(
    x,
    y,
    instanceId
) {

    const menu =
        document.getElementById(
            "context-menu"
        );

    if (!menu) {
        return;
    }

    contextTargetCardId =
        instanceId;
    menu.classList.remove(
        "hidden"
    );
    const rect =
        menu.getBoundingClientRect();
    let finalX =
        x;

    let finalY =
        y;


    if (
        finalX + rect.width >
        window.innerWidth
    ) {

        finalX =
            window.innerWidth -
            rect.width -
            5;
    }


    if (
        finalY + rect.height >
        window.innerHeight
    ) {

        finalY =
            window.innerHeight -
            rect.height -
            5;
    }
    menu.style.left =
        `${Math.max(5, finalX)}px`;
    menu.style.top =
        `${Math.max(5, finalY)}px`;
}
/* =========================================================
   右クリックメニューを閉じる
========================================================= */
function closeContextMenu() {
    const menu =
        document.getElementById(
            "context-menu"
        );
    if (!menu) {
        return;
    }
    menu.classList.add(
        "hidden"
    );
    contextTargetCardId =
        null;
}
function cloneCounters(counters) {
    return {
        green: Number(counters?.green || 0),
        red: Number(counters?.red || 0),
        white: Number(counters?.white || 0),
        blue: Number(counters?.blue || 0),
        yellow: Number(counters?.yellow || 0)
    };
}

function updateCounterEverywhere(instanceId, counters) {
    const next = cloneCounters(counters);
    const seen = new Set();

    const apply = list => {
        if (!Array.isArray(list)) return;
        const card = list.find(c => c && c.instanceId === instanceId);
        if (card) {
            card.counters = cloneCounters(next);
            seen.add(card);
        }
    };

    apply(gameState.boardCards);
    apply(gameState.player1?.board);
    apply(gameState.player2?.board);

    // どの配列にもまだ存在しない場合は、現在の盤面カードを基準にする。
    if (!seen.size) {
        const source = findCardOnBoard(instanceId);
        if (source) source.counters = cloneCounters(next);
    }

    // player1 / player2 の盤面から全体盤面を再構築し、表示元を一本化する。
    gameState.boardCards = [
        ...(gameState.player1?.board || []),
        ...(gameState.player2?.board || [])
    ];
}

function sendCounterUpdate(card) {
    if (!card) return;

    const counters = cloneCounters(card.counters);
    const payloadCard = JSON.parse(JSON.stringify({ ...card, counters }));

    sendGameEvent("counter", {
        cardId: card.instanceId,
        counters,
        card: payloadCard
    });

    sendStateSnapshot();
}

function addCounter(instanceId, type) {
    const card = findBoardCard(instanceId);
    if (!card || !COUNTER_TYPES[type]) return false;

    saveHistory();

    const counters = cloneCounters(card.counters);
    counters[type] += 1;
    updateCounterEverywhere(instanceId, counters);

    const updated = findBoardCard(instanceId);
    sendCounterUpdate(updated);
    renderAll();
    return true;
}

function removeCounter(instanceId, type) {
    const card = findBoardCard(instanceId);
    if (!card || !COUNTER_TYPES[type]) return false;

    saveHistory();

    const counters = cloneCounters(card.counters);
    counters[type] -= 1;
    updateCounterEverywhere(instanceId, counters);

    const updated = findBoardCard(instanceId);
    sendCounterUpdate(updated);
    renderAll();
    return true;
}

// 選択カードの全種類のカウンターを1ずつ増やす
function levelUpSelectedCard() {
    const card = findBoardCard(gameState.selectedCardId);
    if (!card) return false;

    saveHistory();

    const counters = cloneCounters(card.counters);
    Object.keys(COUNTER_TYPES).forEach(type => {
        counters[type] += 1;
    });

    updateCounterEverywhere(card.instanceId, counters);

    const updated = findBoardCard(card.instanceId);
    sendCounterUpdate(updated);
    addLog(`${getCardLabel(updated)}のLvUP：全カウンターを1上昇しました。`);
    renderAll();
    return true;
}

/* =========================================================
   盤面カードを手札へ戻す
========================================================= */
function returnCardToHand(instanceId) {
    const card = findBoardCard(instanceId);
    if (!card) return false;

    const me = getMyPlayerState();
    if (!me) return false;

    const boardIndex = me.board.findIndex(c => c.instanceId === instanceId);
    if (boardIndex === -1) return false;

    saveHistory();
    const [movedCard] = me.board.splice(boardIndex, 1);
    movedCard.faceDown = false;
    me.hand.push(movedCard);

    gameState.boardCards = (gameState.boardCards || []).filter(c => c.instanceId !== instanceId);
    gameState.handCards = (gameState.handCards || []).filter(c => c.instanceId !== instanceId);
    gameState.handCards.push(movedCard);

    sendGameEvent("returnHand", {
        cardId: movedCard.instanceId,
        card: JSON.parse(JSON.stringify(movedCard))
    });
    sendStateSnapshot();

    addLog(`${getCardLabel(movedCard)}を手札に戻しました。`);
    renderAll();
    return true;
}

/* =========================================================
   盤面カードをデッキへ戻す
========================================================= */
function returnCardToDeck(instanceId) {
    const card = findBoardCard(instanceId);
    if (!card) return false;

    const me = getMyPlayerState();
    if (!me) return false;

    const boardIndex = me.board.findIndex(c => c.instanceId === instanceId);
    if (boardIndex === -1) return false;

    saveHistory();
    const [movedCard] = me.board.splice(boardIndex, 1);
    movedCard.faceDown = true;
    me.deck.unshift(movedCard);

    gameState.boardCards = (gameState.boardCards || []).filter(c => c.instanceId !== instanceId);

    sendGameEvent("returnDeck", {
        cardId: movedCard.instanceId,
        card: JSON.parse(JSON.stringify(movedCard))
    });
    sendStateSnapshot();

    addLog(`${getCardLabel(movedCard)}をデッキに戻しました。`);
    renderAll();
    return true;
}

/* =========================================================
   右クリック操作
========================================================= */
function executeContextAction(action) {

    if (!contextTargetCardId) return;

    const card = findBoardCard(contextTargetCardId);
    if (!card) return;

    // ★ 表向き
    if (action === "face-up") {
        saveHistory();
        card.faceDown = false;

        // ★★★ オンライン同期 ★★★
        sendGameEvent("flip", {
            cardId: card.instanceId,
            faceDown: false,
            card: JSON.parse(JSON.stringify(card))
        });

        addLog(`${getCardLabel(card)}を表向きにしました。`);
    }

    // ★ 裏向き
    else if (action === "face-down") {
        saveHistory();
        card.faceDown = true;

        // ★★★ オンライン同期 ★★★
        sendGameEvent("flip", {
            cardId: card.instanceId,
            faceDown: true,
            card: JSON.parse(JSON.stringify(card))
        });

        addLog(`${getCardLabel(card)}を裏向きにしました。`);
    }

    // ★ 手札に戻す
    else if (action === "return-hand") {
        returnCardToHand(card.instanceId);
        closeContextMenu();
        return;
    }

    // ★ デッキに戻す
    else if (action === "return-deck") {
        returnCardToDeck(card.instanceId);
        closeContextMenu();
        return;
    }

    // ★ LvUP：全カウンターを1ずつ上昇
    else if (action === "level-up") {
        gameState.selectedCardId = card.instanceId;
        levelUpSelectedCard();
        closeContextMenu();
        return;
    }

    // ★ スタック（下に重ねる）
    else if (action === "stack") {
        stackCard(card.instanceId);

        // ★★★ オンライン同期 ★★★
        sendGameEvent("stack", {
            cardId: card.instanceId
        });

        return;
    }

    renderAll();
}

/* =========================================================
   カードを下に重ねる
========================================================= */
function stackCard(instanceId) {

    const card = findBoardCard(instanceId);
    if (!card) return;

    saveHistory();

    // ★ プレイヤーごとの盤面を参照
    const board =
        (currentRole === "user1")
            ? gameState.player1.board
            : gameState.player2.board;

    const index = board.findIndex(
        item => item.instanceId === instanceId
    );

    if (index !== -1) {
        const [target] = board.splice(index, 1);
        board.unshift(target);
    }

    addLog(`${getCardLabel(card)}を下に重ねました。`);
    renderBoard();
}


/* =========================================================
   PP
========================================================= */
function injectPPThreeColorStyles() {
    if (document.getElementById("pp-three-color-styles")) return;
    const style = document.createElement("style");
    style.id = "pp-three-color-styles";
    style.textContent = `
        .pp-slot.pp-color-blue {
            background: #222222 !important;
            border-color: #6f9cff !important;
            box-shadow: 0 0 8px rgba(47,111,237,.75);
        }
        .pp-slot.pp-color-green {
            background: #f2c94c !important;
            border-color: #75d98a !important;
            box-shadow: 0 0 8px rgba(50,168,82,.75);
        }
        .pp-slot.pp-color-red {
            background: #32a852 !important;
            border-color: #ff8585 !important;
            box-shadow: 0 0 8px rgba(227,75,75,.75);
        }
    `;
    document.head.appendChild(style);
}

function setupPP() {
    injectPPThreeColorStyles();
    const ppZone =
        document.getElementById(
            "pp-zone"
        );
    if (!ppZone) {
        return;
    }
    const slots =
        ppZone.querySelectorAll(
            ".pp-slot"
        );
    slots.forEach(
        slot => {
            slot.addEventListener(
                "click",
                event => {
                    event.stopPropagation();
                    const index =
                        Number(
                            slot.dataset.pp
                        );
                    if (
                        !Number.isInteger(
                            index
                        ) ||
                        index < 0 ||
                        index >=
                        gameState.pp.length
                    ) {
                        return;
                    }
                    togglePP(
                        index
                    );                }            );        }    );}

/* =========================================================
   PP切り替え
========================================================= */
function togglePP(index) {
    if (!Number.isInteger(index) || index < 0 || index >= gameState.pp.length) {
        return;
    }

    saveHistory();

    // PPは各プレイヤー個別管理。オンライン同期しない。
    // 3色を順番に切り替える: 0=黒 / 1=黄色 / 2=緑
    const currentState = Number(gameState.pp[index] || 0);
    const nextState = (currentState + 1) % 3;

    for (let i = 0; i <= index; i++) {
        gameState.pp[i] = nextState;
    }

    addLog(`PP ${index + 1} までを${nextState === 0 ? "黒" : nextState === 1 ? "黄色" : "緑"}にしました。`, false);
    renderPP();
}


/* =========================================================
   PP描画
========================================================= */

function renderPP() {
    const ppZone = document.getElementById("pp-zone");
    if (!ppZone) return;

    const slots = ppZone.querySelectorAll(".pp-slot");

    slots.forEach((slot, index) => {
        const state = Number(gameState.pp[index] || 0);
        slot.classList.remove("pp-color-blue", "pp-color-green", "pp-color-red");
        if (state === 0) {
            slot.classList.add("pp-color-blue");
        } else if (state === 1) {
            slot.classList.add("pp-color-green");
        } else {
            slot.classList.add("pp-color-red");
        }
        slot.dataset.ppState = String(state);
    });
}



/* =========================================================
   トークン召喚
   指定カード群から画像を見て1枚選択して盤面へ配置
========================================================= */
function summonTokenGroup() {
    if (!currentRole || currentRole === "spectator") {
        alert("トークン召喚はプレイヤーとして参加しているときに使用できます。");
        return;
    }

    const me = currentRole === "user1" ? gameState.player1 : gameState.player2;
    if (!me) return;

    const groups = TOKEN_SUMMON_GROUPS.filter(group =>
        Array.isArray(group.cardIds) && group.cardIds.length
    );
    if (!groups.length) {
        alert("トークン召喚対象が設定されていません。");
        return;
    }

    let groupIndex = 0;
    if (groups.length > 1) {
        const choice = prompt(
            "召喚するトークン群を選択してください。\n" +
            groups.map((group, i) => `${i + 1}: ${group.name}`).join("\n"),
            "1"
        );
        if (choice === null) return;
        groupIndex = Number(choice) - 1;
        if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex >= groups.length) {
            alert("無効な選択です。");
            return;
        }
    }

    const group = groups[groupIndex];
    const candidates = group.cardIds
        .map(cardId => createCard(cardId))
        .filter(Boolean);

    if (!candidates.length) {
        alert("召喚できるカードがありませんでした。カードID設定を確認してください。");
        return;
    }

    /* ---------------------------------------------
       山札サーチ風のカード選択画面
       カード画像をクリックして1枚選択
    --------------------------------------------- */
    const existing = document.getElementById("token-search-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "token-search-overlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.72);
        padding: 24px;
        box-sizing: border-box;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
        width: min(760px, 94vw);
        max-height: 88vh;
        overflow: auto;
        box-sizing: border-box;
        padding: 22px;
        border: 1px solid #555;
        border-radius: 10px;
        background: #202020;
        color: #fff;
        box-shadow: 0 12px 40px rgba(0,0,0,.55);
    `;

    const title = document.createElement("h2");
    title.textContent = "トークン召喚";
    title.style.cssText = "margin:0 0 6px;text-align:center;font-size:20px;";

    const note = document.createElement("p");
    note.textContent = "召喚するカードを選択してください";
    note.style.cssText = "margin:0 0 18px;text-align:center;color:#ccc;font-size:14px;";

    const cardGrid = document.createElement("div");
    cardGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 16px;
        justify-items: center;
    `;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "キャンセル";
    closeButton.style.cssText = `
        display:block;
        margin:20px auto 0;
        padding:8px 24px;
        border:1px solid #555;
        border-radius:6px;
        background:#303030;
        color:#fff;
        cursor:pointer;
    `;
    closeButton.addEventListener("click", () => overlay.remove());

    candidates.forEach(card => {
        const button = document.createElement("button");
        button.type = "button";
        button.title = `${card.cardId}を召喚`;
        button.style.cssText = `
            width: 130px;
            padding: 8px;
            border: 1px solid #555;
            border-radius: 8px;
            background: #2b2b2b;
            color: #fff;
            cursor: pointer;
            transition: transform .12s, border-color .12s;
        `;

        const img = document.createElement("img");
        img.src = getCardImage(card);
        img.alt = `カード${card.cardId}`;
        img.style.cssText = `
            display:block;
            width:100%;
            height:auto;
            max-height:190px;
            object-fit:contain;
            border-radius:4px;
            background:#111;
        `;

        const label = document.createElement("div");
        label.textContent = card.cardId;
        label.style.cssText = "margin-top:7px;font-size:14px;font-weight:bold;";

        button.appendChild(img);
        button.appendChild(label);
        button.addEventListener("mouseenter", () => {
            button.style.transform = "scale(1.04)";
            button.style.borderColor = "#aaa";
        });
        button.addEventListener("mouseleave", () => {
            button.style.transform = "scale(1)";
            button.style.borderColor = "#555";
        });
        button.addEventListener("click", () => {
            overlay.remove();
            placeSummonedToken(card, group, me);
        });

        cardGrid.appendChild(button);
    });

    panel.appendChild(title);
    panel.appendChild(note);
    panel.appendChild(cardGrid);
    panel.appendChild(closeButton);
    overlay.appendChild(panel);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
}

function placeSummonedToken(card, group, me) {
    /* 初期配置カードと同じ座標 */
    card.faceDown = false;
    card.rotated = false;
    card.rotation = false;
    card.x = 350;
    card.y = 600;

    me.board = Array.isArray(me.board) ? me.board : [];
    me.board.push(card);
    rebuildBoardCardsUnique();

    sendGameEvent("initial", {
        cardId: card.instanceId,
        x: card.x,
        y: card.y,
        faceDown: false,
        card: JSON.parse(JSON.stringify(card))
    });

    sendStateSnapshot();
    renderAll();
    addLog(`${getRoleName(currentRole)}がトークンを召喚しました`);
}

function rollDice() {

    // 2d6
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const result = die1 + die2;


    const resultElement =
        document.getElementById(
            "dice-result"
        );


    if (!resultElement) {
        return;
    }


    const numberElement =
        resultElement.querySelector(
            ".dice-result-number"
        );


    if (numberElement) {

        numberElement.textContent =
            result;

    }


    resultElement.classList.remove(
        "hidden"
    );


    sendGameEvent("dice", { die1, die2, result });

    addLog(
        `${getRoleName(currentRole)}が2D6を振って${die1}+${die2}＝${result}をだしました`
    );


    setTimeout(
        () => {

            resultElement.classList.add(
                "hidden"
            );

        },
        1200
    );

}


/* =========================================================
   ログ
========================================================= */

function addLog(message, sync = true, eventId = null) {
    if (!message) return;

    gameState.logEventIds = Array.isArray(gameState.logEventIds) ? gameState.logEventIds : [];
    const id = eventId || `${currentRole || "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (gameState.logEventIds.includes(id)) return;

    const now = new Date();
    const time = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    gameState.logEventIds.push(id);
    gameState.logs.push(`[${time}] ${message}`);
    gameState.logs = gameState.logs.slice(-500);
    if (gameState.logEventIds.length > 500) gameState.logEventIds = gameState.logEventIds.slice(-500);

    renderLogs();

    if (sync) {
        sendGameEvent("log", { id, message, time });
        // ログ単体イベントに加えて最新スナップショットにも含める。
        // これにより途中参加の相手・観戦者にも1P/2P双方のログを引き継げる。
        sendStateSnapshot();
    }
}


/* =========================================================
   ログ描画
========================================================= */

function renderLogs() {

    const logElement =
        document.getElementById(
            "action-log"
        );


    if (!logElement) {
        return;
    }


    logElement.innerHTML =
        "";


    gameState.logs
        .slice()
        .reverse()
        .forEach(
            message => {

                const entry =
                    document.createElement(
                        "div"
                    );


                entry.className =
                    "log-entry";


                entry.textContent =
                    message;


                logElement.appendChild(
                    entry
                );

            }
        );

}


/* =========================================================
   Undo
========================================================= */

function saveHistory() {

    const snapshot =
        JSON.parse(
            JSON.stringify({

                boardCards:
                    gameState.boardCards,

                handCards:
                    gameState.handCards,

                pp:
                    gameState.pp,

                selectedCardId:
                    gameState.selectedCardId

            })
        );


    gameState.history.push(
        snapshot
    );


    if (
        gameState.history.length >
        50
    ) {

        gameState.history.shift();

    }

}


/* =========================================================
   Undo実行
========================================================= */

function undo() {

    if (
        gameState.history.length ===
        0
    ) {

        addLog(
            "元に戻せる操作がありません。"
        );


        return;

    }

    const previous =
        gameState.history.pop();
    gameState.boardCards =
        previous.boardCards;
    gameState.handCards =
        previous.handCards;
    gameState.pp =
        previous.pp;
    gameState.selectedCardId =
        previous.selectedCardId;
    addLog(
        "直前の操作を元に戻しました。"
    );
    renderAll();
}

/* =========================================================
   ドキュメントクリック
========================================================= */

function handleDocumentClick(
    event
) {

    const menu =
        document.getElementById(
            "context-menu"
        );


    if (
        menu &&
        !menu.classList.contains(
            "hidden"
        ) &&
        !menu.contains(
            event.target
        )
    ) {
        closeContextMenu();
    }


    const board = document.getElementById("board");
    const boardCards = document.getElementById("board-cards");

    // 盤面の何もない場所をクリックしたらカード詳細を閉じる。
    if (
        (event.target === board || event.target === boardCards) &&
        !event.target.closest?.(".board-card")
    ) {
        clearCardSelection();
    }

}


/* =========================================================
   役割名
========================================================= */

function getRoleName(
    role
) {

    switch (role) {

        case "user1":
            return "ユーザー1";

        case "user2":
            return "ユーザー2";

        case "spectator":
            return "観戦者";

        default:
            return "プレイヤー";

    }

}

function showInfoScreen() {
    const homeScreen = document.getElementById("home-screen");
    const gameScreen = document.getElementById("game-screen");
    const deckBuilderScreen = document.getElementById("deck-builder-screen");
    const infoScreen = document.getElementById("info-screen");

    homeScreen?.classList.remove("active");
    gameScreen?.classList.remove("active");
    deckBuilderScreen?.classList.remove("active");
    infoScreen?.classList.add("active");
}

function setupInfoScreen() {
    const backButton = document.getElementById("back-to-home-from-info-button");
    if (backButton) {
        backButton.addEventListener("click", () => showHomeScreen());
    }
}

function setupHomeButtons() {

    const user1Button =
        document.getElementById("user1-button");

    const user2Button =
        document.getElementById("user2-button");

    const spectatorButton =
        document.getElementById("spectator-button");


    const sampleDeckSelect =
        document.getElementById("sample-deck-select");

    const deckCodeInput =
        document.getElementById("deck-code-input");

    const startWithDeckButton =
        document.getElementById("start-with-deck-button");


    const deckBuilderButton =
        document.getElementById("deck-builder-button");


    // =========================================================
    // デッキコード取得
    // =========================================================
    function getCurrentDeckCode() {

        if (!deckCodeInput) {
            return "";
        }

        return deckCodeInput.value.trim();
    }


    // =========================================================
    // サンプルデッキ選択
    //
    // サンプルデッキは「コードを入力欄に出力するだけ」
    // =========================================================

    if (sampleDeckSelect) {

        sampleDeckSelect.addEventListener("change", () => {

            const sampleCode =
                sampleDeckSelect.value;

            if (!sampleCode) {
                return;
            }


            const deckList =
                sampleDecks[sampleCode];


            if (!deckList) {

                console.warn(
                    "サンプルデッキが見つかりません:",
                    sampleCode
                );

                return;
            }


            const deckCode =
                generateDeckCode(deckList);


            // デッキコード入力欄に出力
            if (deckCodeInput) {

                deckCodeInput.value =
                    deckCode;

                // 入力欄を見やすくするため選択
                deckCodeInput.focus();
                deckCodeInput.select();
            }

        });
    }


    // =========================================================
    // ユーザー1
    // =========================================================

    if (user1Button) {

        user1Button.addEventListener("click", () => {

            const deckCode =
                getCurrentDeckCode();


            // 入力欄にコードがある場合だけ保存
            if (deckCode) {

                gameState.deckCode =
                    deckCode;
            }


            startGame("user1");
        });
    }


    // =========================================================
    // ユーザー2
    // =========================================================
    if (user2Button) {
        user2Button.addEventListener("click", () => {
            const deckCode =
                getCurrentDeckCode();
            // 入力欄にコードがある場合だけ保存
            if (deckCode) {
                gameState.deckCode =
                    deckCode;
            }
            startGame("user2");
        });
    }

    // =========================================================
    // 観戦
    // =========================================================
    if (spectatorButton) {
        spectatorButton.addEventListener("click", () => {
            startGame("spectator");
        });
    }

    // =========================================================
    // 「デッキで開始」
    //
    // ここでもサンプルデッキは参照しない。
    // 常に入力欄のコードを使用する。
    // =========================================================

    if (startWithDeckButton) {
        startWithDeckButton.addEventListener("click", () => {
            showInfoScreen();
        });
    }

    // // デッキ構築画面へ
if (deckBuilderButton) {
    deckBuilderButton.addEventListener("click",async () => {
        const loaded=await loadCardDatabase();
             if(!loaded) {return;}  showDeckBuilderScreen();
    });
}
    function showDeckBuilderScreen() {
    document.getElementById("home-screen").classList.remove("active");
    document.getElementById("game-screen").classList.remove("active");
    document.getElementById("deck-builder-screen").classList.add("active");

    setupDeckBuilder();
}
    }function setupDeckBuilder() {

    const cardListElement = document.getElementById("builder-card-list");
    const deckListElement = document.getElementById("builder-deck-list");
    const deckCountElement = document.getElementById("deck-count");

    const generateButton = document.getElementById("generate-deck-code-button");
    const loadButton = document.getElementById("load-deck-code-button");
    const deckCodeInput = document.getElementById("builder-deck-code");

    const backButton = document.getElementById("back-to-home-button");

    // デッキデータ
    let builderDeck = [];

    /* =========================
       カード一覧を表示
    ========================= */
    function renderCardList() {
        cardListElement.innerHTML = "";

        for (const cardData of cardDatabase) {
            const div = document.createElement("div");
            div.className = "builder-card";

            div.innerHTML = `
                <img src="${getCardImage(cardData)}">
            `;

            div.addEventListener("click", () => {
                addCardToDeck(cardData.id);
            });

            cardListElement.appendChild(div);
        }
    }

    /* =========================
       デッキに追加
    ========================= */
    function addCardToDeck(cardId) {
        const count = builderDeck.filter(c => c.cardId === cardId).length;
        if (count >= 3) {
            alert("同じカードは3枚までです");
            return;
        }

        if (builderDeck.length >= 60) {
            alert("デッキは60枚までです");
            return;
        }

        builderDeck.push({ cardId });
        renderDeck();
    }

/* =========================
   デッキ表示
========================= */
function renderDeck() {
    deckListElement.innerHTML = "";
    deckCountElement.textContent = builderDeck.length;

    for (const entry of builderDeck) {

        const div = document.createElement("div");
        div.className = "builder-card";

        const cardData = cardDatabase.find(
            c => String(c.id) === String(entry.cardId)
        );

        if (cardData) {
            div.innerHTML = `
                <img src="${getCardImage(cardData)}">
            `;
        } else {
            div.innerHTML = `
                <div>カード${entry.cardId}</div>
            `;
        }

        div.addEventListener("click", () => {
            removeCardFromDeck(entry);
        });

        deckListElement.appendChild(div);
    }
}


function removeCardFromDeck(entry) {
    const index = builderDeck.indexOf(entry);

    if (index !== -1) {
        builderDeck.splice(index, 1);
        renderDeck();
    }
}


/* =========================
   デッキコード生成
========================= */
generateButton.addEventListener("click", () => {

    const grouped = {};

    for (const entry of builderDeck) {
        grouped[entry.cardId] =
            (grouped[entry.cardId] || 0) + 1;
    }

    const code = Object.entries(grouped)
        .map(([id, count]) => `${id}x${count}`)
        .join("-");

    deckCodeInput.value = code;
});


/* =========================
   デッキコード読み込み
========================= */
loadButton.addEventListener("click", () => {

    const code = deckCodeInput.value.trim();

    if (!code) return;

    const parsed = parseDeckCode(code);

    builderDeck = [];

    for (const entry of parsed) {

        for (let i = 0; i < entry.count; i++) {
            builderDeck.push({
                cardId: entry.cardId
            });
        }
    }

    renderDeck();
});


/* =========================
   ホームに戻る
========================= */
backButton.addEventListener("click", () => {
    showHomeScreen();
});


renderCardList();
renderDeck();
}


/* =========================================================
   デッキコード発行
========================================================= */

function parseDeckCode(deckCode) {

    const entries = deckCode.split("-");

    const result = [];

    for (const entry of entries) {

        const [cardId, countStr] = entry.split("x");
        const count = parseInt(countStr, 10);

        if (!cardId || isNaN(count)) {
            continue;
        }

        result.push({
            cardId,
            count
        });
    }

    return result;
}


function createCard(cardId) {

    const cardInfo = cardDatabase.find(
        card => String(card.id) === String(cardId)
    );

    if (!cardInfo) {
        console.warn(
           ` カードID ${cardId} がカードDBに見つかりません`
        );

        return null;
    }

    return createCardData(cardInfo);
}


function buildDeckFromCode(deckCode) {

    const parsed = parseDeckCode(deckCode);
    const deck = [];

    for (const entry of parsed) {

        for (let i = 0; i < entry.count; i++) {

            const card = createCard(entry.cardId);

            if (card) {
                deck.push(card);
            }
        }
    }

    return deck;
}


/* =========================================================
   初期イベント
========================================================= */

function initializeGameEvents() {

    setupBoardDrop();

    setupDeckDoubleClick();
    setupDeckSearch();
}


/* =========================================================
   初期イベント実行
========================================================= */

initializeGameEvents();
setupInfoScreen();


/* =========================================================
   デバッグ用
========================================================= */

window.gameState = gameState;

window.cardDatabase = cardDatabase;
