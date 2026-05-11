const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
    pingTimeout: 10000,   // 10秒无响应认为断开
    pingInterval: 5000    // 每5秒发一次心跳
});

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 内存存储（生产环境建议换 Redis）
const rooms = new Map();      // roomId -> roomData
const playerRoom = new Map(); // socketId -> roomId
const playerIdToSocket = new Map(); // playerId -> socket

// 生成6位房间码
function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms.has(code));
    return code;
}

// 检查五子连珠（服务端校验用）
function checkWin(board, row, col, player) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let [dr, dc] of directions) {
        let count = 1;
        for (let dir of [1, -1]) {
            for (let i = 1; i < 5; i++) {
                const nr = row + dr * i * dir;
                const nc = col + dc * i * dir;
                if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === player) {
                    count++;
                } else break;
            }
        }
        if (count >= 5) return true;
    }
    return false;
}

// 检查平局
function checkDraw(board) {
    return board.every(row => row.every(cell => cell !== 0));
}

// 清理房间
function cleanupRoom(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        room.players.forEach(p => playerRoom.delete(p.id));
        rooms.delete(roomId);
        console.log(`房间 ${roomId} 已清理`);
    }
}

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // ========== 创建房间 ==========
    socket.on('createRoom', (data) => {
        // 如果该playerId已有连接，断开旧连接
        if (data.playerId && playerIdToSocket.has(data.playerId)) {
            const oldSocket = playerIdToSocket.get(data.playerId);
            const oldRoomId = playerRoom.get(oldSocket.id);
            if (oldRoomId) {
                const oldRoom = rooms.get(oldRoomId);
                if (oldRoom) {
                    oldRoom.players = oldRoom.players.filter(p => p.id !== oldSocket.id);
                    playerRoom.delete(oldSocket.id);
                    if (oldRoom.players.length === 0) {
                        cleanupRoom(oldRoomId);
                    }
                }
            }
            oldSocket.disconnect();
        }
        
        if (data.playerId) {
            playerIdToSocket.set(data.playerId, socket);
        }
        
        const roomId = generateRoomCode();
        const room = {
            id: roomId,
            players: [{
                id: socket.id,
                playerId: data.playerId,
                name: data.nickname || '玩家1',
                color: 1,  // 黑棋
                ready: false
            }],
            board: Array(15).fill(null).map(() => Array(15).fill(0)),
            currentPlayer: 1,
            status: 'waiting',  // waiting | playing | finished
            moveHistory: [],
            createdAt: Date.now()
        };
        
        rooms.set(roomId, room);
        playerRoom.set(socket.id, roomId);
        socket.join(roomId);
        
        socket.emit('roomCreated', { roomId, playerColor: 1 });
        console.log(`房间 ${roomId} 已创建`);
    });

    // ========== 加入房间 ==========
    socket.on('joinRoom', (data) => {
        const roomId = data.roomId.toUpperCase();
        const room = rooms.get(roomId);
        
        // 如果该playerId已有连接，断开旧连接
        if (data.playerId && playerIdToSocket.has(data.playerId)) {
            const oldSocket = playerIdToSocket.get(data.playerId);
            const oldRoomId = playerRoom.get(oldSocket.id);
            if (oldRoomId) {
                const oldRoom = rooms.get(oldRoomId);
                if (oldRoom) {
                    oldRoom.players = oldRoom.players.filter(p => p.id !== oldSocket.id);
                    playerRoom.delete(oldSocket.id);
                    if (oldRoom.players.length === 0) {
                        cleanupRoom(oldRoomId);
                    }
                }
            }
            oldSocket.disconnect();
        }
        
        if (data.playerId) {
            playerIdToSocket.set(data.playerId, socket);
        }
        
        if (!room) {
            socket.emit('error', { message: '房间不存在' });
            return;
        }
        if (room.status !== 'waiting') {
            socket.emit('error', { message: '房间已开始或已结束' });
            return;
        }
        if (room.players.length >= 2) {
            socket.emit('error', { message: '房间已满' });
            return;
        }
        
        room.players.push({
            id: socket.id,
            playerId: data.playerId,
            name: data.nickname || '玩家2',
            color: 2,  // 白棋
            ready: false
        });
        
        playerRoom.set(socket.id, roomId);
        socket.join(roomId);
        
        // 通知双方
        socket.emit('joinedRoom', {
            roomId,
            playerColor: 2,
            opponent: room.players[0].name
        });
        socket.to(roomId).emit('playerJoined', {
            playerName: data.nickname || '玩家2'
        });
        
        // 广播房间状态
        io.to(roomId).emit('roomUpdate', {
            players: room.players.map(p => ({ name: p.name, ready: p.ready, color: p.color }))
        });
    });

    // ========== 准备/取消准备 ==========
    socket.on('toggleReady', () => {
        const roomId = playerRoom.get(socket.id);
        const room = rooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = !player.ready;
            io.to(roomId).emit('roomUpdate', {
                players: room.players.map(p => ({ name: p.name, ready: p.ready, color: p.color }))
            });
            
            // 双方都准备了，自动开始
            if (room.players.length === 2 && room.players.every(p => p.ready)) {
                room.status = 'playing';
                io.to(roomId).emit('gameStart', {
                    firstPlayer: 1,
                    players: room.players.map(p => ({ name: p.name, color: p.color }))
                });
            }
        }
    });

    // ========== 落子（核心：服务端校验 + 广播） ==========
    socket.on('placeStone', (data) => {
        const roomId = playerRoom.get(socket.id);
        const room = rooms.get(roomId);
        
        if (!room || room.status !== 'playing') return;
        
        const { row, col } = data;
        const player = room.players.find(p => p.id === socket.id);
        
        // === 反作弊校验 ===
        // 1. 校验是否轮到该玩家
        if (room.currentPlayer !== player.color) {
            socket.emit('error', { message: '还没轮到你' });
            return;
        }
        // 2. 校验坐标合法性
        if (row < 0 || row >= 15 || col < 0 || col >= 15) {
            socket.emit('error', { message: '坐标非法' });
            return;
        }
        // 3. 校验位置是否已被占用
        if (room.board[row][col] !== 0) {
            socket.emit('error', { message: '该位置已有棋子' });
            return;
        }
        
        // 执行落子
        room.board[row][col] = player.color;
        room.moveHistory.push({ row, col, player: player.color, time: Date.now() });
        
        // 广播落子给房间内所有人（包括观战者）
        io.to(roomId).emit('stonePlaced', {
            row, col,
            player: player.color,
            playerName: player.name
        });
        
        // 检查胜负
        if (checkWin(room.board, row, col, player.color)) {
            room.status = 'finished';
            io.to(roomId).emit('gameOver', {
                winner: player.color,
                winnerName: player.name,
                reason: 'win',
                board: room.board
            });
            return;
        }
        
        // 检查平局
        if (checkDraw(room.board)) {
            room.status = 'finished';
            io.to(roomId).emit('gameOver', {
                winner: 0,
                winnerName: null,
                reason: 'draw',
                board: room.board
            });
            return;
        }
        
        // 切换玩家
        room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
        io.to(roomId).emit('turnChange', {
            currentPlayer: room.currentPlayer
        });
    });

    // ========== 认输 ==========
    socket.on('giveUp', () => {
        const roomId = playerRoom.get(socket.id);
        const room = rooms.get(roomId);
        
        if (!room || room.status !== 'playing') return;
        
        const player = room.players.find(p => p.id === socket.id);
        const winner = room.players.find(p => p.id !== socket.id);
        
        room.status = 'finished';
        io.to(roomId).emit('gameOver', {
            winner: winner.color,
            winnerName: winner.name,
            reason: 'giveUp',
            loserName: player.name
        });
    });

    // ========== 再来一局 ==========
    socket.on('playAgain', () => {
        const roomId = playerRoom.get(socket.id);
        const room = rooms.get(roomId);
        
        if (!room || (room.status !== 'finished' && room.status !== 'playing')) return;
        
        // 重置棋盘和状态
        room.board = Array(15).fill(null).map(() => Array(15).fill(0));
        room.currentPlayer = 1;
        room.status = 'waiting';
        room.moveHistory = [];
        
        // 重置准备状态
        room.players.forEach(p => p.ready = false);
        
        io.to(roomId).emit('roomUpdate', {
            players: room.players.map(p => ({ name: p.name, ready: p.ready, color: p.color }))
        });
    });

    // ========== 断开连接 ==========
    socket.on('disconnect', () => {
        console.log('用户断开:', socket.id);
        
        const roomId = playerRoom.get(socket.id);
        if (!roomId) return;
        
        const room = rooms.get(roomId);
        if (!room) return;
        
        // 从房间中移除玩家
        room.players = room.players.filter(p => p.id !== socket.id);
        playerRoom.delete(socket.id);
        
        if (room.players.length === 0) {
            // 房间空了，删除
            cleanupRoom(roomId);
        } else {
            // 通知房间内其他人
            socket.to(roomId).emit('playerLeft');
            
            if (room.status === 'playing') {
                // 游戏进行中，对方获胜
                room.status = 'finished';
                const winner = room.players[0];
                socket.to(roomId).emit('gameOver', {
                    winner: winner.color,
                    winnerName: winner.name,
                    reason: 'opponentLeft'
                });
            } else {
                // 更新房间状态
                io.to(roomId).emit('roomUpdate', {
                    players: room.players.map(p => ({ name: p.name, ready: p.ready, color: p.color }))
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
