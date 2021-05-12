async function engineGame(options) {
  options = options || {};
  var game = new Chess();
  /// We can load Stockfish via Web Workers or via STOCKFISH() if loaded from a <script> tag.
  var engine =
    typeof STOCKFISH === 'function'
      ? STOCKFISH()
      : new Worker(options.stockfishjs || 'stockfish.js');
  var evaler =
    typeof STOCKFISH === 'function'
      ? STOCKFISH()
      : new Worker(options.stockfishjs || 'stockfish.js');
  var engineStatus = {};
  var time = { wtime: 300000, btime: 300000, winc: 2000, binc: 2000 };
  var playerColor = 'white';
  var announced_game_over;
  // do not pick up pieces if the game is over

  const extension = tableau.extensions;
  let parameters = {};
  let playFrom, playTo;
  let dashboard;
  let state = 'A1::B1::C1::D1::E1::F1::G1::H1::A2::B2::C2::D2::E2::F2::G2::H2::A8::B8::C8::D8::E8::F8::G8::H8::A7::B7::C7::D7::E7::F7::G7::H7'.split(
    '::'
  );
  let originalState =
    'A1::B1::C1::D1::E1::F1::G1::H1::A2::B2::C2::D2::E2::F2::G2::H2::A8::B8::C8::D8::E8::F8::G8::H8::A7::B7::C7::D7::E7::F7::G7::H7';

  return tableau.extensions.initializeAsync().then(() => {
    dashboard = extension.dashboardContent.dashboard;

    // lets hide the initial frame
    let removeFrame = dashboard.objects.find((x) => {
      return x.name === 'init';
    });

    let zoneVisibilityMap = {};
    zoneVisibilityMap[removeFrame.id] = 'hide';

    dashboard.setZoneVisibilityAsync(zoneVisibilityMap);

    dashboard.getParametersAsync().then((params) => {
      params.forEach((parameter) => {
        const name = parameter.name;
        parameters[name] = parameter;

        if (parameter.name === 'state') {
          parameter.changeValueAsync(state.join('::'));
        }

        if (parameter.name === 'playTo') {
          parameter.changeValueAsync('');
          parameter.addEventListener('parameter-changed', function (selectionEvent) {
            move();
          });
        }
        if (parameter.name === 'level') {
          parameter.addEventListener('parameter-changed', function (selectionEvent) {
            setSkill();
          });
        }
        if (parameter.name === 'playFrom') {
          parameter.changeValueAsync('');
        }
        if (parameter.name === 'message') {
          parameter.changeValueAsync('');
        }
        if (parameter.name === 'level') {
          parameter.changeValueAsync('Beginner');
        }
      });
    });
    // });

    function move() {
      dashboard.getParametersAsync().then((params) => {
        params.forEach((parameter) => {
          if (parameter.name === 'playFrom') {
            playFrom = parameter.currentValue.value;
          }
          if (parameter.name === 'playTo') {
            playTo = parameter.currentValue.value;
          }
        });

        if (playFrom && playTo) {
          movePiece(playFrom, playTo);
        }
      });
    }

    function setSkill() {
      dashboard.getParametersAsync().then((params) => {
        params.forEach((parameter) => {
          skill = parseInt(parameter.currentValue.value, 10);
          if (parameter.name === 'level') {
            if (skill < 0) {
              skill = 0;
            }
            if (skill > 20) {
              skill = 20;
            }

            time.level = skill;

            /// Change thinking depth allowance.
            if (skill < 5) {
              time.depth = '1';
            } else if (skill < 10) {
              time.depth = '2';
            } else if (skill < 15) {
              time.depth = '3';
            } else {
              /// Let the engine decide.
              time.depth = '';
            }

            ///NOTE: Stockfish level 20 does not make errors (intentially), so these numbers have no effect on level 20.
            /// Level 0 starts at 1
            err_prob = Math.round(skill * 6.35 + 1);
            /// Level 0 starts at 10
            max_err = Math.round(skill * -0.5 + 10);
            // game.setSkillLevel(parseInt(parameter.currentValue.value, 10));
          }
        });
      });
    }

    var resetGame = function () {
      state = originalState.split('::');
      dashboard.getParametersAsync().then((params) => {
        params.forEach((parameter) => {
          const name = parameter.name;
          parameters[name] = parameter;

          if (parameter.name === 'state') {
            parameter.changeValueAsync(originalState);
          }
          if (parameter.name === 'playTo') {
            parameter.changeValueAsync('');
          }
          if (parameter.name === 'playFrom') {
            parameter.changeValueAsync('');
          }
          if (parameter.name === 'message') {
            parameter.changeValueAsync('Game started, it is your turn!');
          }
          if (parameter.name === 'level') {
            parameter.changeValueAsync('Beginner');
          }
        });
      });
    };

    setInterval(function () {
      if (announced_game_over) {
        return;
      }

      if (game.game_over()) {
        announced_game_over = true;
        alert('Game Over');
      }
    }, 1000);

    function uciCmd(cmd, which) {
      (which || engine).postMessage(cmd);
    }

    ///TODO: Eval starting posistions. I suppose the starting positions could be different in different chess varients.
    function get_moves() {
      var moves = '';
      var history = game.history({ verbose: true });

      for (var i = 0; i < history.length; ++i) {
        var move = history[i];
        moves += ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
      }

      return moves;
    }

    function prepareMove() {
      var turn = game.turn() == 'w' ? 'white' : 'black';
      if (!game.game_over()) {
        if (turn != playerColor) {
          uciCmd('position startpos moves' + get_moves());
          uciCmd('position startpos moves' + get_moves(), evaler);
          uciCmd('eval', evaler);

          if (time && time.wtime) {
            uciCmd(
              'go ' +
                (time.depth ? 'depth ' + time.depth : '') +
                ' wtime ' +
                time.wtime +
                ' winc ' +
                time.winc +
                ' btime ' +
                time.btime +
                ' binc ' +
                time.binc
            );
          } else {
            uciCmd('go ' + (time.depth ? 'depth ' + time.depth : ''));
          }
          isEngineRunning = true;
        }
      }
    }

    engine.onmessage = function (event) {
      var line;

      if (event && typeof event === 'object') {
        line = event.data;
      } else {
        line = event;
      }
      if (line == 'uciok') {
        engineStatus.engineLoaded = true;
      } else if (line == 'readyok') {
        engineStatus.engineReady = true;
      } else {
        var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        /// Did the AI move?
        if (match) {
          isEngineRunning = false;
          game.move({ from: match[1], to: match[2], promotion: match[3] });

          // delay opponent
          // found a piece? Remove from state
          if (state.indexOf(match[2].toUpperCase()) > -1) {
            state[state.indexOf(match[2].toUpperCase())] = 'A100';
          }

          // AI castles
          if (match[1].toUpperCase() === 'E8' && match[2].toUpperCase() === 'G8') {
            state[state.indexOf('H8')] = 'F8';
          }
          state[state.indexOf(match[1].toUpperCase())] = match[2].toUpperCase();

          setTimeout(() => {
            parameters['state'].changeValueAsync(state.join('::'));

            parameters['message'].changeValueAsync('Your turn!');
          }, Math.floor(2 + Math.random() * Math.floor(10)) * 1000);

          prepareMove();
          uciCmd('eval', evaler);

          /// Is it sending feedback?
        } else if ((match = line.match(/^info .*\bdepth (\d+) .*\bnps (\d+)/))) {
          engineStatus.search = 'Depth: ' + match[1] + ' Nps: ' + match[2];
        }

        /// Is it sending feed back with a score?
        if ((match = line.match(/^info .*\bscore (\w+) (-?\d+)/))) {
          var score = parseInt(match[2]) * (game.turn() == 'w' ? 1 : -1);
          /// Is it measuring in centipawns?
          if (match[1] == 'cp') {
            engineStatus.score = (score / 100.0).toFixed(2);
            /// Did it find a mate?
          } else if (match[1] == 'mate') {
            engineStatus.score = 'Mate in ' + Math.abs(score);
          }

          /// Is the score bounded?
          if ((match = line.match(/\b(upper|lower)bound\b/))) {
            engineStatus.score =
              ((match[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineStatus.score;
          }
        }
      }
    };

    var movePiece = function (source, target) {
      // same? Players wants to deselect
      if (source === target) {
        parameters['playFrom'].changeValueAsync('');
        parameters['playTo'].changeValueAsync('');
        return;
      }
      // lets move!
      var move = game.move({
        from: source,
        to: target,
        promotion: 'q', // q ueen, r ook, b ishop, k night
      });
      // illegal move
      if (move === null) {
        parameters['playFrom'].changeValueAsync('');
        parameters['playTo'].changeValueAsync('');
        parameters['message'].changeValueAsync('Illegal move!');
        return;
      }
      // good move
      parameters['playFrom'].changeValueAsync('');
      parameters['playTo'].changeValueAsync('');
      // found a piece from enemy? Remove from state
      if (state.indexOf(playTo.toUpperCase()) > -1) {
        state[state.indexOf(playTo.toUpperCase())] = 'A100';
      }
      // castling
      if (source === 'e1' && target === 'g1') {
        state[state.indexOf('H1')] = 'F1';
      }
      // lets update the new pos of the set
      state[state.indexOf(playFrom.toUpperCase())] = playTo.toUpperCase();
      parameters['state'].changeValueAsync(state.join('::'));
      // It's the turn of the AI
      prepareMove();
      parameters['message'].changeValueAsync('Tableau is thinking...');
    };

    return {
      reset: function () {
        game.reset();
        this.setSkillLevel(14);
        resetGame();
      },
      loadPgn: function (pgn) {
        game.load_pgn(pgn);
      },
      setSkillLevel: function (skill) {
        var max_err, err_prob, difficulty_slider;

        if (skill < 0) {
          skill = 0;
        }
        if (skill > 20) {
          skill = 20;
        }

        time.level = skill;

        /// Change thinking depth allowance.
        if (skill < 5) {
          time.depth = '1';
        } else if (skill < 10) {
          time.depth = '2';
        } else if (skill < 15) {
          time.depth = '3';
        } else {
          /// Let the engine decide.
          time.depth = '';
        }

        ///NOTE: Stockfish level 20 does not make errors (intentially), so these numbers have no effect on level 20.
        /// Level 0 starts at 1
        err_prob = Math.round(skill * 6.35 + 1);
        /// Level 0 starts at 10
        max_err = Math.round(skill * -0.5 + 10);
      },
      setDepth: function (depth) {
        time = { depth: depth };
      },
      setNodes: function (nodes) {
        time = { nodes: nodes };
      },
      start: function () {
        engineStatus.engineReady = false;
        engineStatus.search = null;
        prepareMove();
        announced_game_over = false;
      },
    };
  });
}
