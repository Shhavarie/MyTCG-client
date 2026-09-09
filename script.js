
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
    hand.push(card);
}/* =========================================================
  同期カード移動
========================================================= */
function applyMove(player, payload) {
    const { cardId, x, y } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    card.x = x;
    card.y = y;
}/* =========================================================
  同期裏向き
========================================================= */
function applyFlip(player, payload) {
    const { cardId, faceDown } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    card.faceDown = faceDown;
}
/* =========================================================
  同期回転
========================================================= */
function applyRotate(player, payload) {
    const { cardId, rotation } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    card.rotation = rotation;
}
/* =========================================================
  同期カウンター
========================================================= */
function applyCounter(player, payload) {
    const { cardId, color, value } = payload;

    const card = findCardOnBoard(cardId);
    if (!card) return;

    if (!card.counters) card.counters = {};

    card.counters[color] = (card.counters[color] || 0) + value;
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
function applyPPChange(player, payload) {
    const { index, value } = payload;

    // PP配列を更新
    gameState.pp[index] = value;

    // PP再描画
    renderPP();
}

/* =========================================================
   同期受信
========================================================= */
function applyGameEvent(event) {
    const { type, player, payload } = event;

    switch (type) {
        case "draw": applyDraw(player, payload); break;
        case "play": applyPlay(player, payload); break;
        case "move": applyMove(player, payload); break;
        case "flip": applyFlip(player, payload); break;
        case "rotate": applyRotate(player, payload); break;
        case "counter": applyCounter(player, payload); break;
        case "initial": applyInitial(player, payload); break;
        case "ppChange": applyPPChange(player, payload); break;

        // 任意イベント
        case "select": applySelect(player, payload); break;
        case "endTurn": applyEndTurn(player, payload); break;
        case "shuffle": applyShuffle(player, payload); break;
        case "remove": applyRemove(player, payload); break;
        case "handRemove": applyHandRemove(player, payload); break;
    }

    renderAll();
}
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

    const card = deck.find(c => c.instanceId === cardId);
    if (!card) return;

    deck.splice(deck.indexOf(card), 1);

    card.faceDown = faceDown;

    hand.push(card);
}
/* =========================================================
  同期カード移動
========================================================= */
function applyPlay(player, payload) {
    const { cardId, x, y, faceDown } = payload;

    let hand;

    if (player === "user1") {
        hand = gameState.player1.hand;
    } else {
        hand = gameState.player2.hand;
    }

    const card = hand.find(c => c.instanceId === cardId);
    if (!card) return;

    hand.splice(hand.indexOf(card), 1);

    card.x = x;
    card.y = y;
    card.faceDown = faceDown;

    gameState.boardCards.push(card);
}
function applyMove(player, payload) {
    const { cardId, x, y } = payload;

    const card = gameState.boardCards.find(c => c.instanceId === cardId);
    if (!card) return;

    card.x = x;
    card.y = y;
}

/* =========================================================
  同期裏向き
========================================================= */
function applyFlip(player, payload) {
    const { cardId, faceDown } = payload;

    const card = gameState.boardCards.find(c => c.instanceId === cardId);
    if (!card) return;

    card.faceDown = faceDown;
}

/* =========================================================
  同期回転
========================================================= */
function applyRotate(player, payload) {
    const { cardId, rotation } = payload;

    const card = gameState.boardCards.find(c => c.instanceId === cardId);
    if (!card) return;

    card.rotation = rotation;
}

/* =========================================================
  同期カウンター
========================================================= */
function applyCounter(player, payload) {
    const { cardId, color, value } = payload;

    const card = gameState.boardCards.find(c => c.instanceId === cardId);
    if (!card) return;

    if (!card.counters) card.counters = {};

    card.counters[color] = (card.counters[color] || 0) + value;
}

/* =========================================================
   同期初期配置
========================================================= */
function applyInitial(player, payload) {
    const { cardId, x, y } = payload;

    let deck, hand;

    if (player === "user1") {
        deck = gameState.player1.deck;
        hand = gameState.player1.hand;
    } else {
        deck = gameState.player2.deck;
        hand = gameState.player2.hand;
    }

    let card =
        deck.find(c => c.instanceId === cardId) ||
        hand.find(c => c.instanceId === cardId);

    if (!card) return;

    card.x = x;
    card.y = y;

    gameState.boardCards.push(card);
}
/* =========================================================
   同期PP
========================================================= */
function applyPPChange(player, payload) {
    const { index, value } = payload;

    gameState.pp[index] = value;

    renderPP();
}





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
    pp: Array(20).fill(false),
    history: [],
    logs: []
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
   初期化
========================================================= */
document.addEventListener(
    "DOMContentLoaded",
    () => {
        setupHomeButtons();
        setupGameButtons();
        setupContextMenu();
        setupPP();
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

    if (!deckCode) {
        alert("デッキコードが入力されていません。");
        return;
    }

    currentRole = role;

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

        pp: Array(20).fill(false),

        history: [],
        logs: [],

        deckCode: deckCode
    };

    /*
       startGame() 内で gameState を作り直しているので、
       デバッグ用の window.gameState も更新する
    */
    window.gameState = gameState;

    /* ---------------------------------------------------------
       デッキ構築
    --------------------------------------------------------- */

    const deck = buildDeckFromCode(deckCode);

    console.log("生成されたデッキ枚数:", deck.length);

    if (deck.length === 0) {
        alert(
            "デッキを作成できませんでした。\n" +
            "デッキコードまたはカードIDを確認してください。"
        );
        return;
    }

    /* ---------------------------------------------------------
       プレイヤーへデッキをセット
    --------------------------------------------------------- */

    if (role === "user1") {

        gameState.player1.deck = deck;

    } else if (role === "user2") {

        gameState.player2.deck = deck;

    } else if (role === "spectator") {

        /*
           観戦者の場合は、ここではデッキを操作しない
        */

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
            gameState.boardCards.push(initialCard);

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

    /* ---------------------------------------------------------
       WebSocket接続
    --------------------------------------------------------- */

    try {

        connectWebSocket();

    } catch (error) {

        console.warn(
            "WebSocket接続に失敗しました。",
            error
        );

        /*
           WebSocketが使えなくても、
           ローカルゲーム自体は続行できるようにする
        */
    }

    console.log("ゲーム開始処理完了");
}

/* =========================================================
   My TCG Simulator
   script.js
========================================================= */
// WebSocket 接続（Render の URLを後で入れる）
let ws = null;

function connectWebSocket() {
  ws = new WebSocket("wss://ctcg-ws-server.onrender.com");

    ws.onopen = () => {
        addLog("オンライン対戦サーバーに接続しました。");
    };

    ws.onmessage = (msg) => {
        const event = JSON.parse(msg.data);
        applyGameEvent(event);   // ← 受信したイベントを反映する
    };

    ws.onclose = () => {
        addLog("サーバーとの接続が切れました。");
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
}

function sendGameEvent(type, payload = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket が接続されていません");
        return;
    }

    const event = {
        type: type,
        player: currentRole,   // user1 / user2
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

    const homeScreen =
        document.getElementById("home-screen");

    const gameScreen =
        document.getElementById("game-screen");

    const deckBuilderScreen =
        document.getElementById("deck-builder-screen");


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

    let handCards = [];

    if (currentRole === "user1") {

        handCards =
            gameState.player1.hand;

    } else if (currentRole === "user2") {

        handCards =
            gameState.player2.hand;

    } else {

        // 観戦者は手札を持たない
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
   ゲーム用カード作成
========================================================= */
function createCardData(cardInfo) {
    const card = {
        instanceId:
           `card-${gameState.nextCardId++}`,
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
                    card.counters[counterType] || 0
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

function renderBoard() {

    const boardCardsElement =
        document.getElementById("board-cards");

    if (!boardCardsElement) {
        return;
    }

    boardCardsElement.innerHTML = "";

        const board =
        (currentRole === "user1")
            ? gameState.player1.board
            : gameState.player2.board;

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

            cardElement.style.left =
                `${card.x}px`;

            cardElement.style.top =
                `${card.y}px`;
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


            /* =========================
               ダブルクリック＝横向き
            ========================== */

            cardElement.addEventListener(
                "dblclick",
                event => {

                    event.stopPropagation();

                    rotateCard(
                        card.instanceId
                    );

                }
            );


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
                card.counters[counterType] || 0
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

    // ローカル更新
    card.rotated = !card.rotated;

    // ★★★ オンライン同期 ★★★
    sendGameEvent("rotate", {
        cardId: card.instanceId,
        rotation: card.rotated
    });

    addLog(
        `${getCardLabel(card)}を${card.rotated ? "横向き" : "縦向き"}にしました。`
    );

    renderBoard();
}

/* =========================================================
   ボードカード検索
========================================================= */

function findBoardCard(instanceId) {

    const board =
        (currentRole === "user1")
            ? gameState.player1.board
            : gameState.player2.board;

    return board.find(c => c.instanceId === instanceId) || null;
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
            renderHand();
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

        // ★★★ オンライン同期（play）★★★
        sendGameEvent("play", {
            cardId: card.instanceId,
            x: card.x,
            y: card.y,
            faceDown: card.faceDown
        });

        addLog(`${getCardLabel(card)}をボードに配置しました。`);

        renderAll();
    });}


/* =========================================================
   ドロー
========================================================= */
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
    const card = deck.shift();
    if (!card) {
        addLog("カードを引けませんでした。");
        return;
    }

    // 裏向きで引く場合
    card.faceDown = faceDown;

    // ★ プレイヤーの手札に追加
    hand.push(card);

    // ログ
    addLog(
        faceDown
            ? "カードを裏向きで引きました。"
            : `${getCardLabel(card)}を引きました。`
    );

    // 手札を更新
    renderHand();
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
       マウスが出た
    ========================== */

    imageWrap.addEventListener(
        "mouseleave",
        () => {

            console.log(
                "★ 拡大鏡 mouseleave"
            );


            if (!loupe) {
                return;
            }


            loupe.style.display =
                "none";
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
            card.counters[counterType] += difference;
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
            faceDown: false
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
            faceDown: true
        });

        addLog(`${getCardLabel(card)}を裏向きにしました。`);
    }

    // ★ カウンター追加
    else if (action.startsWith("add-counter-")) {
        const type = action.replace("add-counter-", "");

        addCounter(card.instanceId, type);

        // ★★★ オンライン同期 ★★★
        sendGameEvent("counter", {
            cardId: card.instanceId,
            color: type,
            value: +1
        });

        return;
    }

    // ★ カウンター削除
    else if (action.startsWith("remove-counter-")) {
        const type = action.replace("remove-counter-", "");

        removeCounter(card.instanceId, type);

        // ★★★ オンライン同期 ★★★
        sendGameEvent("counter", {
            cardId: card.instanceId,
            color: type,
            value: -1
        });

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
function setupPP() {
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

    saveHistory();

    const nextState = !gameState.pp[index];

    for (let i = 0; i <= index; i++) {
        gameState.pp[i] = nextState;
    }

    // ★★★ オンライン同期 ★★★
    sendGameEvent("ppChange", {
        index: index,
        value: nextState
    });

    addLog(`マナコスト ${index + 1} までを ${nextState ? "ON" : "OFF"} にしました。`);

    renderPP();
}


/* =========================================================
   PP描画
========================================================= */

function renderPP() {

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
        (slot, index) => {

            if (
                gameState.pp[index]
            ) {

                slot.classList.add(
                    "active"
                );

            } else {

                slot.classList.remove(
                    "active"
                );

            }

        }
    );

}


/* =========================================================
   ダイス
========================================================= */

function rollDice() {

    const result =
        Math.floor(
            Math.random() * 6
        ) + 1;


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


    addLog(
        `ダイスを振って${result}が出ました。`
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

function addLog(
    message
) {

    const now =
        new Date();


    const time =
        now.toLocaleTimeString(
            "ja-JP",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );


    gameState.logs.push(
        `[${time}] ${message}`
    );


    renderLogs();

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


    const board =
        document.getElementById(
            "board"
        );

    if (
        board &&
        event.target === board
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
            const deckCode =
                getCurrentDeckCode();
            if (!deckCode) {
                alert(
                    "デッキコードを入力してください。"
                );
                return;
            }

            // 入力欄のコードを保存
            gameState.deckCode =
                deckCode;

            // ユーザー1として開始
            startGame("user1");
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
}


/* =========================================================
   初期イベント実行
========================================================= */

initializeGameEvents();


/* =========================================================
   デバッグ用
========================================================= */

window.gameState = gameState;

window.cardDatabase = cardDatabase;