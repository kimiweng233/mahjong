import { useEffect, useState } from 'react';

/**
 * Draw / discard / claim (Phase 6.3: claim_tripps, claim_quads, claim_straight).
 * @param {{ gameSnapshot: object, myPlayerId: string, socket: import('socket.io-client').Socket | null }} props
 */
export default function GameTable({ gameSnapshot, myPlayerId, socket }) {
  const [actionError, setActionError] = useState(null);
  const [claimSecondsLeft, setClaimSecondsLeft] = useState(null);

  const round = gameSnapshot?.round;
  const phase = round?.phase;
  const claimDeadlineAt = round?.claimDeadlineAt;
  const inClaim = phase === 'claim';

  useEffect(() => {
    if (!inClaim || !claimDeadlineAt) {
      setClaimSecondsLeft(null);
      return;
    }
    const tick = () => {
      const ms = Math.max(0, claimDeadlineAt - Date.now());
      setClaimSecondsLeft(Math.ceil(ms / 1000));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [inClaim, claimDeadlineAt]);

  if (!round) return null;

  const { scores, players, roundIndex } = gameSnapshot;
  const mySeat = round.yourSeatIndex;
  const currentTurn = round.currentTurn;

  const myTurnDraw = phase === 'draw' && currentTurn === mySeat;
  const myTurnDiscard = phase === 'discard' && currentTurn === mySeat;

  const handleDraw = () => {
    setActionError(null);
    socket?.emit('draw', {}, (ack) => {
      if (ack?.error) setActionError(ack.error);
    });
  };

  const handleDiscardTile = (tileId) => {
    if (!myTurnDiscard) return;
    setActionError(null);
    socket?.emit('discard', { tileId }, (ack) => {
      if (ack?.error) setActionError(ack.error);
    });
  };

  const handleClaimTripps = () => {
    setActionError(null);
    socket?.emit('claim_tripps', {}, (ack) => {
      if (ack?.error) setActionError(ack.error);
    });
  };

  const handleClaimQuads = () => {
    setActionError(null);
    socket?.emit('claim_quads', {}, (ack) => {
      if (ack?.error) setActionError(ack.error);
    });
  };

  const handleClaimStraight = (handTileIds) => {
    setActionError(null);
    socket?.emit('claim_straight', { handTileIds }, (ack) => {
      if (ack?.error) setActionError(ack.error);
    });
  };

  let turnBanner = '';
  if (phase === 'draw' && currentTurn !== null && currentTurn !== undefined) {
    turnBanner =
      currentTurn === mySeat
        ? 'Your turn — draw from the wall.'
        : `Seat ${currentTurn + 1}'s turn — draw.`;
  } else if (phase === 'discard' && currentTurn !== null && currentTurn !== undefined) {
    turnBanner =
      currentTurn === mySeat
        ? 'Your turn — choose a tile to discard.'
        : `Seat ${currentTurn + 1}'s turn — discard.`;
  } else if (inClaim) {
    const nextS = round.nextPlayerAfterClaim;
    turnBanner =
      nextS !== null && nextS !== undefined
        ? `Claim window. Next draw if no claim: seat ${nextS + 1}${
            claimSecondsLeft != null ? ` — ${claimSecondsLeft}s` : ''
          }`
        : 'Claim window…';
  }

  const claimOpts = round.claimOptionsBySeat;
  const myClaimTypes =
    claimOpts && typeof claimOpts === 'object'
      ? claimOpts[mySeat] ?? claimOpts[String(mySeat)]
      : null;

  return (
    <div className="game-table">
      <h2>Table</h2>
      {turnBanner && <p className="turn-banner">{turnBanner}</p>}
      <p>
        Round {roundIndex + 1} · Scores: {scores.join(' / ')} · Phase: {phase}
      </p>
      {round.lastDiscard && (
        <p>
          Last discard: {round.lastDiscard.tileId} (from seat {round.lastDiscard.fromSeat + 1})
        </p>
      )}
      <p>Wall tiles left: {round.wallTilesRemaining}</p>

      {round.openMelds?.length > 0 && (
        <div className="open-melds">
          <strong>Open melds</strong>
          <ul className="open-melds-list">
            {round.openMelds.map((m, i) => (
              <li key={`meld-${i}-${m.seat}-${m.type}`}>
                Seat {m.seat + 1}: {m.type} — {m.tiles.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {inClaim && claimOpts && (
        <div className="claim-options">
          <p>
            {myClaimTypes?.length ? (
              <>
                <strong>You may declare:</strong> {myClaimTypes.join(', ')}
              </>
            ) : (
              <span>No claims available for you on this discard.</span>
            )}
          </p>
          <p className="claim-actions">
            {myClaimTypes?.includes('quads') && (
              <button type="button" className="claim-btn" onClick={handleClaimQuads}>
                Quads
              </button>
            )}
            {myClaimTypes?.includes('tripps') && (
              <button type="button" className="claim-btn" onClick={handleClaimTripps}>
                Tripps
              </button>
            )}
            {myClaimTypes?.includes('straight') &&
              round.claimStraightPairs?.length === 1 && (
                <button
                  type="button"
                  className="claim-btn"
                  onClick={() => handleClaimStraight(round.claimStraightPairs[0].handTileIds)}
                >
                  Straight ({round.claimStraightPairs[0].handTileIds.join(' + ')})
                </button>
              )}
            {myClaimTypes?.includes('straight') &&
              (round.claimStraightPairs?.length ?? 0) > 1 &&
              round.claimStraightPairs.map((opt, i) => (
                <button
                  key={`st-${opt.handTileIds.join('-')}-${i}`}
                  type="button"
                  className="claim-btn"
                  onClick={() => handleClaimStraight(opt.handTileIds)}
                >
                  Straight: {opt.handTileIds.join(' + ')}
                </button>
              ))}
          </p>
        </div>
      )}

      {myTurnDraw && (
        <p>
          <button type="button" onClick={handleDraw}>
            Draw from wall
          </button>
        </p>
      )}
      {actionError && (
        <p className="action-error" style={{ color: 'red' }}>
          {actionError}
        </p>
      )}

      <div className="discard-summary">
        <strong>Discards (count per seat)</strong>
        <ul className="discard-counts">
          {players.map((p) => (
            <li key={p.playerId}>
              Seat {p.seatIndex + 1}:{' '}
              {round.discardCounts?.[p.seatIndex] ?? round.discards?.[p.seatIndex]?.length ?? 0} tiles
              {p.presence === 'away' && (
                <span
                  className="player-presence-away"
                  title="Disconnected — may rejoin"
                  aria-label="Disconnected"
                />
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="game-seats">
        {players.map((p) => {
          const isMe = p.playerId === myPlayerId;
          const hand = round.hands[p.seatIndex];
          const masked = hand && typeof hand.count === 'number';

          return (
            <div key={p.playerId} className={`game-seat ${isMe ? 'me' : ''}`}>
              <strong>
                Seat {p.seatIndex + 1}: {p.name}
                {p.presence === 'away' && (
                  <span
                    className="player-presence-away"
                    title="Disconnected — may rejoin"
                    aria-label="Disconnected"
                  />
                )}
                {isMe ? ' (You)' : ''}
              </strong>
              {masked ? (
                <div className="hand-concealed">{hand.count} tiles (hidden)</div>
              ) : (
                <ul className="hand-tiles">
                  {hand.map((tileId, i) => (
                    <li key={`${p.seatIndex}-${i}-${tileId}`}>
                      {isMe && myTurnDiscard ? (
                        <button type="button" className="tile-btn" onClick={() => handleDiscardTile(tileId)}>
                          {tileId}
                        </button>
                      ) : (
                        tileId
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
