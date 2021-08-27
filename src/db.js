const mysql = require('mysql2');
const { sumAllParticipants, convertParticipantsAmountsToStrings } = require('./lib/dbHelpers');

const MYSQL_MIN_DATETIME = '1000-01-01';
const MYSQL_MAX_DATETIME = '9999-12-31';

const util = require('util');

const previousSettlementWindowDataQuery = `
  SELECT id,
    MAX(payments) AS payments,
    MAX(receipts) AS receipts,
    MAX(numPayments) AS numPayments,
    MAX(numReceipts) AS numReceipts,
    curr,
    MIN(open) AS open,
    MIN(close) AS close FROM
  (
    (
      SELECT
        sw.settlementWindowId AS id,
        0 AS payments,
        0 AS receipts,
        0 AS numPayments,
        0 AS numReceipts,
        c.currencyId AS curr,
        MIN(swOpen.createdDate) AS open,
        MIN(swClose.createdDate) AS close
      FROM central_ledger.settlementWindow sw
      INNER JOIN central_ledger.settlementWindowStateChange AS swClose ON swClose.settlementWindowId = sw.settlementWindowId
      INNER JOIN central_ledger.settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = sw.settlementWindowId
      CROSS JOIN (
          SELECT pc.currencyId
          FROM participantCurrency AS pc
          INNER JOIN participant AS p ON pc.participantId = p.participantId
          INNER JOIN ledgerAccountType AS lat ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
          WHERE p.name = ?
            AND lat.name = 'POSITION'
          ) AS c
      WHERE swClose.settlementWindowStateId = 'CLOSED'
        AND swOpen.settlementWindowStateId = 'OPEN'
      GROUP BY id, curr
    )
    UNION
    (
      SELECT
        swClose.settlementWindowId as id,
        SUM(CASE WHEN tprt.name = 'PAYER_DFSP' THEN q.amount ELSE 0 END) as payments,
        SUM(CASE WHEN tprt.name = 'PAYEE_DFSP' THEN q.amount ELSE 0 END) as receipts,
        COUNT(CASE WHEN tprt.name = 'PAYER_DFSP' THEN q.amount ELSE NULL END) as numPayments,
        COUNT(CASE WHEN tprt.name = 'PAYEE_DFSP' THEN q.amount ELSE NULL END) as numReceipts,
        q.currencyId AS curr,
        MIN(swOpen.createdDate) AS open,
        MIN(swClose.createdDate) AS close
      FROM central_ledger.settlementWindowStateChange AS swClose
      INNER JOIN central_ledger.settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = swClose.settlementWindowId
      INNER JOIN central_ledger.transferFulfilment AS tf ON swClose.settlementWindowId = tf.settlementWindowId
      INNER JOIN central_ledger.transactionReference AS tr ON tf.transferId = tr.transactionReferenceId
      INNER JOIN central_ledger.quote AS q ON tr.quoteId = q.quoteId
      INNER JOIN central_ledger.quoteParty AS qp ON q.quoteId = qp.quoteId
      INNER JOIN central_ledger.transferParticipantRoleType AS tprt ON tprt.transferParticipantRoleTypeId = qp.transferParticipantRoleTypeId
      INNER JOIN central_ledger.participant AS p ON p.participantId = qp.participantId
      WHERE p.name = ?
        AND swClose.settlementWindowStateId = 'CLOSED'
        AND swOpen.settlementWindowStateId = 'OPEN'
      GROUP BY id, curr
    )
    ORDER BY open
  ) T
  WHERE id = (
    SELECT swOpen.settlementWindowId
    FROM settlementWindowStateChange swOpen
    INNER JOIN settlementWindowStateChange swClose ON swClose.settlementWindowId = swOpen.settlementWindowId
    WHERE swClose.settlementWindowStateId = 'CLOSED'
      AND swOpen.settlementWindowStateId = 'OPEN'
    ORDER BY swClose.createdDate DESC
    LIMIT 1
  )
  GROUP BY id, curr
  ORDER BY close DESC
`;

// TODO: change the line 'AND sw.createdDate < (...)' to 'AND sw.createdDate = (...)'
// TODO: evaluate what information in this query is not necessary for the UI
// TODO: remove the LIMIT 1 clause at the end of this query
const currentSettlementWindowQueryPayments = `
  SELECT SUM(q.amount) AS senderAmount, COUNT(q.amount) AS numTransactions, qpPayer.fspId, qpPayer.participantId, q.currencyId, sw.createdDate AS settlementWindowOpen, ANY_VALUE(sw.settlementWindowId) AS settlementWindowId
  FROM central_ledger.transferFulfilment AS tf
  INNER JOIN central_ledger.transactionReference AS tr ON tf.transferId = tr.transactionReferenceId
  INNER JOIN central_ledger.quote AS q ON tr.quoteId = q.quoteId
  INNER JOIN central_ledger.quoteParty AS qpPayee ON q.quoteId = qpPayee.quoteId
  INNER JOIN central_ledger.transferParticipantRoleType AS tprtPayee ON tprtPayee.transferParticipantRoleTypeId = qpPayee.transferParticipantRoleTypeId
  INNER JOIN central_ledger.participant AS p ON p.name = qpPayee.fspId
  INNER JOIN central_ledger.quoteParty AS qpPayer ON qpPayee.quoteId = qpPayer.quoteId
  INNER JOIN central_ledger.transferParticipantRoleType AS tprtPayer ON tprtPayer.transferParticipantRoleTypeId = qpPayer.transferParticipantRoleTypeId
  INNER JOIN central_ledger.settlementWindowStateChange AS sw ON sw.settlementWindowId = tf.settlementWindowId
  WHERE tf.settlementWindowId = sw.settlementWindowId
    AND tprtPayee.name = 'PAYER_DFSP'
    AND tprtPayer.name = 'PAYEE_DFSP'
    AND p.participantId = ?
    AND sw.settlementWindowStateId = 'OPEN' -- use settlementWindowStateId because enumeration is not unique
    AND sw.createdDate = (SELECT MAX(swsq.createdDate) FROM central_ledger.settlementWindowStateChange AS swsq WHERE swsq.settlementWindowStateId = 'OPEN')
  GROUP BY qpPayer.fspId, qpPayer.participantId, q.currencyId, sw.createdDate
`;

// TODO: change the line 'AND sw.createdDate < (...)' to 'AND sw.createdDate = (...)'
// TODO: evaluate what information in this query is not necessary for the UI. Probably just
//       numTransactions, senderAmount, and perhaps fspId.
// TODO: remove the LIMIT 1 clause at the end of this query
const currentSettlementWindowQueryReceipts = `
  SELECT SUM(q.amount) AS senderAmount, COUNT(q.amount) AS numTransactions, qpPayer.fspId, qpPayer.participantId, q.currencyId, sw.createdDate AS settlementWindowOpen, ANY_VALUE(sw.settlementWindowId) AS settlementWindowId
  FROM central_ledger.transferFulfilment AS tf
  INNER JOIN central_ledger.transactionReference AS tr ON tf.transferId = tr.transactionReferenceId
  INNER JOIN central_ledger.quote AS q ON tr.quoteId = q.quoteId
  INNER JOIN central_ledger.quoteParty AS qpPayee ON q.quoteId = qpPayee.quoteId
  INNER JOIN central_ledger.transferParticipantRoleType AS tprtPayee ON tprtPayee.transferParticipantRoleTypeId = qpPayee.transferParticipantRoleTypeId
  INNER JOIN central_ledger.participant AS p ON p.name = qpPayee.fspId
  INNER JOIN central_ledger.quoteParty AS qpPayer ON qpPayee.quoteId = qpPayer.quoteId
  INNER JOIN central_ledger.transferParticipantRoleType AS tprtPayer ON tprtPayer.transferParticipantRoleTypeId = qpPayer.transferParticipantRoleTypeId
  INNER JOIN central_ledger.settlementWindowStateChange AS sw ON sw.settlementWindowId = tf.settlementWindowId
  WHERE tf.settlementWindowId = sw.settlementWindowId
    AND tprtPayee.name = 'PAYEE_DFSP'
    AND tprtPayer.name = 'PAYER_DFSP'
    AND p.participantId = ?
    AND sw.settlementWindowStateId = 'OPEN' -- use settlementWindowStateId because enumeration is not unique
    AND sw.createdDate = (SELECT MAX(swsq.createdDate) FROM central_ledger.settlementWindowStateChange AS swsq WHERE swsq.settlementWindowStateId = 'OPEN')
  GROUP BY qpPayer.fspId, qpPayer.participantId, q.currencyId, sw.createdDate
`;

const currentSettlementWindowId = `SELECT sw.settlementWindowId 
  FROM central_ledger.settlementWindow sw
  INNER JOIN central_ledger.settlementWindowStateChange AS swOpen
  ON swOpen.settlementWindowId = sw.settlementWindowId
  WHERE swOpen.settlementWindowStateId = 'OPEN'
  order by swOpen.createdDate DESC LIMIT 1;
`;

// TODO: the limit history is being kept in the participantLimit table, so we need to return only
// the most recent limit for each currency.
const positionQuery = `
  SELECT
    pl.createdDate AS limitCreatedDate,
    pl.participantLimitId,
    pp.value AS position,
    pl.value AS 'limit',
    pc.currencyId as currency,
    pc.participantId,
    pl.participantLimitId
  FROM
    participantLimit pl
  INNER JOIN
    participantCurrency pc ON pl.participantCurrencyId = pc.participantCurrencyId
  INNER JOIN
    participantPosition pp ON pp.participantCurrencyId = pc.participantCurrencyId
  INNER JOIN
    ledgerAccountType lat ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
  WHERE
    lat.name = 'POSITION'
  AND
    pc.participantId = ?
  AND 
    pc.isActive = 1
  -- GROUP BY pc.participantId
  -- GROUP BY pl.participantCurrencyId
  -- ORDER BY pl.createdDate DESC
`;

const historicalSettlementWindowDataQuery = `
  SELECT
    id,
    MAX(payments) AS payments,
    MAX(receipts) AS receipts,
    MAX(numPayments) AS numPayments,
    MAX(numReceipts) AS numReceipts,
    curr,
    MIN(open) AS open,
    MIN(close) AS close FROM
    (
      (
        SELECT
          sw.settlementWindowId AS id,
          0 AS payments,
          0 AS receipts,
          0 AS numPayments,
          0 AS numReceipts,
          c.currencyId AS curr,
          MIN(swOpen.createdDate) AS open,
          MIN(swClose.createdDate) AS close
        FROM central_ledger.settlementWindow sw
        INNER JOIN central_ledger.settlementWindowStateChange AS swClose ON swClose.settlementWindowId = sw.settlementWindowId
        INNER JOIN central_ledger.settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = sw.settlementWindowId
        CROSS JOIN (
            SELECT pc.currencyId
            FROM participantCurrency AS pc
            INNER JOIN participant AS p ON pc.participantId = p.participantId
            INNER JOIN ledgerAccountType AS lat ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
            WHERE p.name = ?
              AND lat.name = 'POSITION'
            ) AS c
        WHERE swClose.settlementWindowStateId = 'CLOSED'
          AND swOpen.settlementWindowStateId = 'OPEN'
        GROUP BY id, curr
      )
      UNION
      (
        SELECT
          swClose.settlementWindowId as id,
          SUM(CASE WHEN tprt.name = 'PAYER_DFSP' THEN q.amount ELSE 0 END) as payments,
          SUM(CASE WHEN tprt.name = 'PAYEE_DFSP' THEN q.amount ELSE 0 END) as receipts,
          COUNT(CASE WHEN tprt.name = 'PAYER_DFSP' THEN q.amount ELSE NULL END) as numPayments,
          COUNT(CASE WHEN tprt.name = 'PAYEE_DFSP' THEN q.amount ELSE NULL END) as numReceipts,
          q.currencyId AS curr,
          MIN(swOpen.createdDate) AS open,
          MIN(swClose.createdDate) AS close
        FROM central_ledger.settlementWindowStateChange AS swClose
        INNER JOIN central_ledger.settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = swClose.settlementWindowId
        INNER JOIN central_ledger.transferFulfilment AS tf ON swClose.settlementWindowId = tf.settlementWindowId
        INNER JOIN central_ledger.transactionReference AS tr ON tf.transferId = tr.transactionReferenceId
        INNER JOIN central_ledger.quote AS q ON tr.quoteId = q.quoteId
        INNER JOIN central_ledger.quoteParty AS qp ON q.quoteId = qp.quoteId
        INNER JOIN central_ledger.transferParticipantRoleType AS tprt ON tprt.transferParticipantRoleTypeId = qp.transferParticipantRoleTypeId
        INNER JOIN central_ledger.participant AS p ON p.participantId = qp.participantId
        WHERE p.name = ?
          AND swClose.settlementWindowStateId = 'CLOSED'
          AND swOpen.settlementWindowStateId = 'OPEN'
        GROUP BY id, curr
        ORDER BY swClose.createdDate DESC
      )
    ) T
  WHERE T.open > ? AND T.close < ?
  GROUP BY id, curr
  ORDER BY open
`;

const historicalParticipantPositionQuery = `
  (
    SELECT ppc.createdDate, ppc.value, c.currencyId
    FROM participantPositionChange ppc
    INNER JOIN participantPosition pp ON ppc.participantPositionId = pp.participantPositionId
    INNER JOIN participantCurrency pc ON pc.participantCurrencyId = pp.participantCurrencyId
    INNER JOIN currency c ON c.currencyId = pc.currencyId
    INNER JOIN ledgerAccountType lat ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
    INNER JOIN participant p ON p.participantId = pc.participantId
    WHERE c.currencyId = ?
      AND lat.name = 'POSITION'
      AND p.name = ?
      AND ppc.createdDate > ?
      AND ppc.createdDate < ?
    ORDER BY ppc.createdDate DESC
  )
  UNION
  (
    SELECT ppc.createdDate, ppc.value, c.currencyId
    FROM participantPositionChange ppc
    INNER JOIN participantPosition pp ON ppc.participantPositionId = pp.participantPositionId
    INNER JOIN participantCurrency pc ON pc.participantCurrencyId = pp.participantCurrencyId
    INNER JOIN currency c ON c.currencyId = pc.currencyId
    INNER JOIN ledgerAccountType lat ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
    INNER JOIN participant p ON p.participantId = pc.participantId
    WHERE c.currencyId = ?
      AND lat.name = 'POSITION'
      AND p.name = ?
      AND ppc.createdDate < ?
    ORDER BY ppc.createdDate DESC
    LIMIT 1
  )
  UNION
  (
    SELECT ppc.createdDate, ppc.value, c.currencyId
    FROM participantPositionChange ppc
    INNER JOIN participantPosition pp ON ppc.participantPositionId = pp.participantPositionId
    INNER JOIN participantCurrency pc ON pc.participantCurrencyId = pp.participantCurrencyId
    INNER JOIN currency c ON c.currencyId = pc.currencyId
    INNER JOIN ledgerAccountType lat ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
    INNER JOIN participant p ON p.participantId = pc.participantId
    WHERE c.currencyId = ?
      AND lat.name = 'POSITION'
      AND p.name = ?
      AND ppc.createdDate > ?
    ORDER BY ppc.createdDate DESC
    LIMIT 1
  )
  ORDER BY createdDate DESC
`;

const historicalParticipantLimitQuery = `
  (
    SELECT c.currencyId AS curr, pl.value AS lim, pl.createdDate
    FROM central_ledger.participantLimit pl
    INNER JOIN central_ledger.participantLimitType AS plt ON plt.participantLimitTypeId = pl.participantLimitTypeId
    INNER JOIN central_ledger.participantCurrency AS pc ON pc.participantCurrencyId = pl.participantCurrencyId
    INNER JOIN central_ledger.currency AS c ON c.currencyId = pc.currencyId
    INNER JOIN central_ledger.participant AS p ON pc.participantId = p.participantId
    WHERE plt.name = 'NET_DEBIT_CAP'
      AND pl.createdDate > ?
      AND pl.createdDate < ?
      AND p.name = ?
      AND c.currencyId = ?
    ORDER BY pl.createdDate DESC
  )
  UNION
  (
    SELECT c.currencyId AS curr, pl.value AS lim, pl.createdDate
    FROM central_ledger.participantLimit pl
    INNER JOIN central_ledger.participantLimitType AS plt ON plt.participantLimitTypeId = pl.participantLimitTypeId
    INNER JOIN central_ledger.participantCurrency AS pc ON pc.participantCurrencyId = pl.participantCurrencyId
    INNER JOIN central_ledger.currency AS c ON c.currencyId = pc.currencyId
    INNER JOIN central_ledger.participant AS p ON pc.participantId = p.participantId
    WHERE plt.name = 'NET_DEBIT_CAP'
      AND pl.createdDate < ?
      AND p.name = ?
      AND c.currencyId = ?
    ORDER BY pl.createdDate DESC
    LIMIT 1
  )
  UNION
  (
    SELECT c.currencyId AS curr, pl.value AS lim, pl.createdDate
    FROM central_ledger.participantLimit pl
    INNER JOIN central_ledger.participantLimitType AS plt ON plt.participantLimitTypeId = pl.participantLimitTypeId
    INNER JOIN central_ledger.participantCurrency AS pc ON pc.participantCurrencyId = pl.participantCurrencyId
    INNER JOIN central_ledger.currency AS c ON c.currencyId = pc.currencyId
    INNER JOIN central_ledger.participant AS p ON pc.participantId = p.participantId
    WHERE plt.name = 'NET_DEBIT_CAP'
      AND pl.createdDate > ?
      AND p.name = ?
      AND c.currencyId = ?
    ORDER BY pl.createdDate DESC
    LIMIT 1
  )
  ORDER BY createdDate DESC
`;

const settlementWindowInfoQuery = `
SELECT
  totals.settlementWindowId,
  totals.settlementWindowStateId AS settlementWindowStateId,
  SUM(totals.amount) AS amount,
  GROUP_CONCAT(DISTINCT(totals.currencyId)) as currencyId,
  DATE_FORMAT(MIN(swOpen.createdDate), '%Y-%m-%dT%T.000Z') AS settlementWindowOpen,
  DATE_FORMAT(MIN(swClose.createdDate), '%Y-%m-%dT%T.000Z') AS settlementWindowClose
FROM  (
  SELECT DISTINCT ssw.settlementWindowId, swsc.settlementWindowStateId, CASE WHEN spc.netAmount > 0 THEN spc.netAmount ELSE 0 END AS amount, pc.currencyId
    FROM settlement
    INNER JOIN settlementStateChange AS ssc ON ssc.settlementStateChangeId = settlement.currentStateChangeId
    INNER JOIN settlementSettlementWindow AS ssw ON ssw.settlementId = settlement.settlementId
    INNER JOIN settlementWindow AS sw ON sw.settlementWindowId = ssw.settlementWindowId
    INNER JOIN settlementWindowStateChange AS swsc ON swsc.settlementWindowStateChangeId = sw.currentStateChangeId
    INNER JOIN settlementParticipantCurrency AS spc ON spc.settlementId = settlement.settlementId
    INNER JOIN settlementParticipantCurrencyStateChange AS spcsc ON spcsc.settlementParticipantCurrencyStateChangeId = spc.currentStateChangeId
    INNER JOIN participantCurrency AS pc ON pc.participantCurrencyId = spc.participantCurrencyId
    INNER JOIN participant AS p ON p.participantId = pc.participantId
    WHERE ssw.settlementWindowId = ?
) AS totals
INNER JOIN settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = totals.settlementWindowId
LEFT JOIN settlementWindowStateChange AS swClose ON swClose.settlementWindowId = totals.settlementWindowId
WHERE swOpen.settlementWindowStateId = 'OPEN'
   AND swClose.settlementWindowStateId = 'CLOSED'
GROUP BY totals.settlementWindowId
UNION
SELECT sw.settlementWindowId, swsc.settlementWindowStateId, 0 AS amount, 'N/A' AS currencyId, date_format(swOpen.createdDate, '%Y-%m-%dT%T.000Z') AS settlementWindowOpen, date_format(swClose.createdDate, '%Y-%m-%dT%T.000Z') AS settlementWindowClose
  FROM central_ledger.settlementWindow AS sw
  INNER JOIN central_ledger.settlementWindowStateChange AS swsc ON swsc.settlementWindowStateChangeId = sw.currentStateChangeId
  INNER JOIN central_ledger.settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = sw.settlementWindowId
  INNER JOIN central_ledger.settlementWindowStateChange AS swClose ON swClose.settlementWindowId = sw.settlementWindowId
  WHERE sw.settlementWindowId = ?
    AND swClose.settlementWindowStateId = 'CLOSED'
   AND swOpen.settlementWindowStateId = 'OPEN'
    AND NOT EXISTS (select 1 from central_ledger.settlementSettlementWindow AS ssw WHERE ssw.settlementWindowId = ?)
UNION
SELECT sw.settlementWindowId, swsc.settlementWindowStateId, 0 AS amount, 'N/A' AS currencyId, date_format(swOpen.createdDate, '%Y-%m-%dT%T.000Z') AS settlementWindowOpen, 'N/A' AS settlementWindowClose
  FROM central_ledger.settlementWindow AS sw
  INNER JOIN central_ledger.settlementWindowStateChange AS swsc ON swsc.settlementWindowStateChangeId = sw.currentStateChangeId
  INNER JOIN central_ledger.settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = sw.settlementWindowId
 WHERE sw.settlementWindowId = ? AND NOT EXISTS (SELECT 1 FROM central_ledger.settlementWindowStateChange AS swClose
 WHERE swClose.settlementWindowId = sw.settlementWindowId AND swClose.settlementWindowStateId = 'CLOSED')
 UNION
SELECT sw.settlementWindowId, swsc.settlementWindowStateId, 0 AS amount, 'N/A' AS currencyId, date_format(swOpen.createdDate, '%Y-%m-%dT%T.000Z') AS settlementWindowOpen, date_format(swClose.createdDate, '%Y-%m-%dT%T.000Z') AS settlementWindowClose
  FROM central_ledger.settlementWindow AS sw
  INNER JOIN central_ledger.settlementWindowStateChange AS swsc ON swsc.settlementWindowStateChangeId = sw.currentStateChangeId
  INNER JOIN central_ledger.settlementWindowStateChange AS swOpen ON swOpen.settlementWindowId = sw.settlementWindowId
  INNER JOIN central_ledger.settlementWindowStateChange AS swClose ON swClose.settlementWindowId = sw.settlementWindowId
  INNER JOIN central_ledger.settlementSettlementWindow AS ssw ON ssw.settlementWindowId = sw.settlementWindowId
 WHERE sw.settlementWindowId = ?
  AND swClose.settlementWindowStateId = 'CLOSED'
  AND swOpen.settlementWindowStateId = 'OPEN'
  AND NOT EXISTS (select 1 from central_ledger.settlement WHERE settlement.settlementId = ssw.settlementId)
`;

const outAmountQuery = `
SELECT DISTINCT ssw.settlementWindowId, pc.currencyId as currency, sca.amount AS outAmount, p.name AS fspId, p.participantId
 FROM settlement
 INNER JOIN settlementSettlementWindow AS ssw ON ssw.settlementId = settlement.settlementId
 INNER JOIN settlementWindow AS sw ON sw.settlementWindowId = ssw.settlementWindowId
 INNER JOIN settlementContentAggregation AS sca ON sca.settlementId = settlement.settlementId
 INNER JOIN participantCurrency AS pc ON pc.participantCurrencyId = sca.participantCurrencyId
 INNER JOIN participant AS p ON p.participantId = pc.participantId
 WHERE ssw.settlementWindowId = ?
 AND sca.amount > 0
`;

const inAmountQuery = `
SELECT DISTINCT ssw.settlementWindowId, pc.currencyId as currency, sca.amount AS inAmount, p.name AS fspId, p.participantId
 FROM settlement
 INNER JOIN settlementSettlementWindow AS ssw ON ssw.settlementId = settlement.settlementId
 INNER JOIN settlementWindow AS sw ON sw.settlementWindowId = ssw.settlementWindowId
 INNER JOIN settlementContentAggregation AS sca ON sca.settlementId = settlement.settlementId
 INNER JOIN participantCurrency AS pc ON pc.participantCurrencyId = sca.participantCurrencyId
 INNER JOIN participant AS p ON p.participantId = pc.participantId
 WHERE ssw.settlementWindowId = ?
 AND sca.amount < 0
`;

const netAmountQuery = `
SELECT settlementWindowId, sum(netAmount) AS netAmount, fspId, participantId, currency
FROM (
  SELECT DISTINCT ssw.settlementWindowId, spc.netAmount, p.name AS fspId, p.participantId, pc.currencyId as currency
  FROM settlement
    INNER JOIN settlementSettlementWindow AS ssw ON ssw.settlementId = settlement.settlementId
    INNER JOIN settlementWindow AS sw ON sw.settlementWindowId = ssw.settlementWindowId
    INNER JOIN settlementParticipantCurrency AS spc ON spc.settlementId = settlement.settlementId
    INNER JOIN participantCurrency AS pc ON pc.participantCurrencyId = spc.participantCurrencyId
    INNER JOIN participant AS p ON p.participantId = pc.participantId
  WHERE ssw.settlementWindowId = ? ) AS tab
 GROUP BY settlementWindowId, fspId, participantId, currency
`;

const settlementSettlementWindowQuery = `
SELECT s.settlementId from settlement s
  INNER JOIN settlementSettlementWindow ssw ON ssw.settlementId = s.settlementId
  INNER JOIN settlementWindow sw ON sw.settlementWindowId = ssw.settlementWindowId
WHERE sw.settlementWindowId = ?
`;

const settlementWindowsInSettlementQuery = `
SELECT sw.settlementWindowId from settlementWindow sw
  INNER JOIN settlementSettlementWindow ssw ON sw.settlementWindowId = ssw.settlementWindowId
  INNER JOIN settlement s on s.settlementId = ssw.settlementId
WHERE s.settlementId = ?
AND sw.settlementWindowId != ?
`;

const settlementAccountBalanceQuery = `
  SELECT
    pp.value AS settlementBalance,
    pc.currencyId as currency
  FROM
    participantCurrency pc
  INNER JOIN
    participantPosition pp ON pp.participantCurrencyId = pc.participantCurrencyId
  INNER JOIN
    ledgerAccountType lat ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
  WHERE
    lat.name = 'SETTLEMENT'
  AND
    pc.participantId = ?
  AND 
    pc.isActive = 1
`;

const transferDetailsQuery = `
SELECT t.transferId, pPayer.name as payer, pPayee.name as payee, t.createdDate
  FROM transfer t
  INNER JOIN transferParticipant tpPayer ON tpPayer.transferId = t.transferId
  INNER JOIN participantCurrency pcPayer ON pcPayer.participantCurrencyId = tpPayer.participantCurrencyId
  INNER JOIN participant pPayer ON pPayer.participantId = pcPayer.participantId
  INNER JOIN transferParticipantRoleType tprtPayer ON tprtPayer.transferParticipantRoleTypeId = tpPayer.transferParticipantRoleTypeId
  INNER JOIN transferParticipant tpPayee ON tpPayee.transferId = t.transferId
  INNER JOIN participantCurrency pcPayee ON pcPayee.participantCurrencyId = tpPayee.participantCurrencyId
  INNER JOIN participant pPayee ON pPayee.participantId = pcPayee.participantId
  INNER JOIN transferParticipantRoleType tprtPayee ON tprtPayee.transferParticipantRoleTypeId = tpPayee.transferParticipantRoleTypeId
WHERE t.transferId = ?
  AND tprtPayee.name = 'PAYEE_DFSP'
  AND tprtPayer.name = 'PAYER_DFSP'
`;

const settlementWindowListQuery = `
SELECT
    settlementWindowId,
    ANY_VALUE(settlementWindowStateId) AS 'state',
    ANY_VALUE(settlementWindowReason) AS 'reason',
    ANY_VALUE(createdDate) AS 'settlementWindowOpen',
    ANY_VALUE(settlementWindowClose) AS 'settlementWindowClose',
    sum(accountAmount) AS 'amount',
    accountCurrency AS 'currency'
FROM
(
  SELECT distinct sw.settlementWindowId,
            swsc.settlementWindowStateId, swsc.reason AS settlementWindowReason, sw.createdDate,
            swClose.createdDate AS 'settlementWindowClose',
            spc.netAmount AS accountAmount, pc.currencyId AS accountCurrency
  FROM settlement
  INNER JOIN settlementSettlementWindow AS ssw ON  ssw.settlementId = settlement.settlementId
  INNER JOIN settlementWindow AS sw ON sw.settlementWindowId = ssw.settlementWindowId
  INNER JOIN settlementWindowStateChange AS swsc ON swsc.settlementWindowStateChangeId = sw.currentStateChangeId
  INNER JOIN settlementParticipantCurrency AS spc ON spc.settlementId = settlement.settlementId -- AND spc.participantCurrencyId = stp.participantCurrencyId
  INNER JOIN settlementParticipantCurrencyStateChange AS spcsc ON spcsc.settlementParticipantCurrencyStateChangeId = spc.currentStateChangeId
  INNER JOIN participantCurrency AS pc ON pc.participantCurrencyId = spc.participantCurrencyId
  INNER JOIN settlementWindowStateChange AS swClose ON swClose.settlementWindowId = sw.settlementWindowId

  WHERE spc.netAmount >= 0
  AND swClose.settlementWindowStateId = 'CLOSED'

  UNION ALL

  SELECT
    sw.settlementWindowId,
    swsc.settlementWindowStateId AS 'state',
    swsc.reason AS 'reason',
    sw.createdDate AS 'settlementWindowOpen',
    NULL AS 'settlementWindowClose',
    0 AS 'amount',
    NULL AS 'currency'
        FROM settlementWindow sw
          INNER JOIN settlementWindowStateChange AS swsc ON swsc.settlementWindowStateChangeId = sw.currentStateChangeId
        WHERE
            swsc.settlementWindowStateId = 'OPEN' 

) AS t

WHERE createdDate BETWEEN ? AND ?
GROUP BY settlementWindowId, accountCurrency
ORDER BY settlementWindowId DESC
`;

const findTransfersQuery = `
SELECT
    qpPayer.fspid as payerFspid,
    qpPayee.fspid as payeeFspid,
    q.transactionReferenceId as transferId,
    tS.name as transactionType,
    q.createdDate as quoteTimestamp,
    t.createdDate as transferTimestamp,
    pITPayer.name as payerIdType,
    qpPayer.partyIdentifierValue as payerIdValue,
    pITPayee.name as payeeIdType,
    qpPayee.partyIdentifierValue as payeeIdValue,
    q.amount as amount,
    c.currencyId as currency,
    IFNULL(ts.enumeration, 'QUOTE ONLY') as state
FROM
    quote q
    INNER JOIN quoteParty qpPayer on qpPayer.quoteId = q.quoteId AND qpPayer.partyTypeId = (SELECT partyTypeId FROM partyType WHERE name = 'PAYER')
        INNER JOIN partyIdentifierType pITPayer ON pITPayer.partyIdentifierTypeId = qpPayer.partyIdentifierTypeId
    INNER JOIN quoteParty qpPayee on qpPayee.quoteId = q.quoteId AND qpPayee.partyTypeId = (SELECT partyTypeId FROM partyType WHERE name = 'PAYEE')
        INNER JOIN partyIdentifierType pITPayee ON pITPayee.partyIdentifierTypeId = qpPayee.partyIdentifierTypeId
    INNER JOIN transactionScenario tS on tS.transactionScenarioId = q.transactionScenarioId
    INNER JOIN currency c ON c.currencyId = q.currencyId

    LEFT JOIN transfer t on t.transferId = q.transactionReferenceId
    LEFT JOIN transferFulfilment tF on tF.transferId = t.transferId
    LEFT JOIN (SELECT MAX(transferStateChangeId) as tscId, transferId FROM transferStateChange GROUP BY transferId ORDER BY transferId) tscid ON tscid.transferId = t.transferId
    LEFT JOIN transferStateChange tsc ON tsc.transferStateChangeId = tscid.tscId
    LEFT JOIN transferState ts ON ts.transferStateId = tsc.transferStateId
    WHERE
        transactionReferenceId LIKE ?
        AND qpPayer.fspid LIKE ?
        AND qpPayee.fspid LIKE ?
        AND pITPayer.name LIKE ?
        AND pITPayee.name LIKE ?
        AND qpPayer.partyIdentifierValue LIKE ?
        AND qpPayee.partyIdentifierValue LIKE ?
        AND q.createdDate BETWEEN ? AND ?
    LIMIT 1000
`;

const transferAllDetailsQueries = {
    quoteRequests: `SELECT
            q.quoteId as quoteId,
            q.transactionReferenceId as transactionReferenceId,
            q.transactionRequestId as transactionRequestId,
            q.note as note,
            q.expirationDate as expirationDate,
            q.amount as amount,
            q.createdDate as createdDate,
            ti.name as transactionInitiator,
            tit.name as transactionInitiatorType,
            ts.name as transactionScenario,
            tss.name as transactionSubScenario,
            bop.name as balanceOfPaymentsType,
            at.name as amountType,
            q.currencyId as currency
        FROM
            quote q
            INNER JOIN transactionInitiator ti on ti.transactionInitiatorId = q.transactionInitiatorId
            INNER JOIN transactionInitiatorType tit on tit.transactionInitiatorTypeId = q.transactionInitiatorTypeId
            INNER JOIN transactionScenario ts on ts.transactionScenarioId = q.transactionScenarioId
            INNER JOIN amountType at on at.amountTypeId = q.amountTypeId

            LEFT JOIN balanceOfPayments bop on bop.balanceOfPaymentsId = q.balanceOfPaymentsId
            LEFT JOIN transactionSubScenario tss on tss.transactionSubScenarioId = q.transactionSubScenarioId
        WHERE
            q.transactionReferenceId = ?`,
    quoteParties: `SELECT 
            quoteParty.quoteId,
            partyIdentifierType.name as partyIdentifierType,
            quoteParty.partyIdentifierValue,
            quoteParty.fspId,
            quoteParty.merchantClassificationCode,
            quoteParty.partyName,
            transferParticipantRoleType.name as transferParticipantRoleType,
            ledgerEntryType.name as ledgerEntryType,
            quoteParty.amount,
            quoteParty.currencyId,
            quoteParty.createdDate,
            quoteParty.partySubIdOrTypeId,
            participant.name as participant
        FROM
            quoteParty
            INNER JOIN partyIdentifierType ON quoteParty.partyIdentifierTypeId = partyIdentifierType.partyIdentifierTypeId
            INNER JOIN transferParticipantRoleType ON quoteParty.transferParticipantRoleTypeId = transferParticipantRoleType.transferParticipantRoleTypeId
            INNER JOIN ledgerEntryType ON quoteParty.ledgerEntryTypeId = ledgerEntryType.ledgerEntryTypeId
            INNER JOIN participant ON quoteParty.participantId = participant.participantId
            INNER JOIN quote ON quoteParty.quoteId = quote.quoteId
        WHERE
            quote.transactionReferenceId = ?`,
    quoteResponses: `SELECT 
            quote.quoteId,
            quote.transactionReferenceId,
            quoteResponse.quoteResponseId,
            quoteResponse.transferAmountCurrencyId,
            quoteResponse.transferAmount,
            quoteResponse.payeeReceiveAmountCurrencyId,
            quoteResponse.payeeReceiveAmount,
            quoteResponse.payeeFspFeeCurrencyId,
            quoteResponse.payeeFspFeeAmount,
            quoteResponse.payeeFspCommissionCurrencyId,
            quoteResponse.payeeFspCommissionAmount,
            quoteResponse.ilpCondition,
            quoteResponse.responseExpirationDate,
            quoteResponse.isValid,
            quoteResponse.createdDate,
            quoteResponseIlpPacket.value as ilpPacket
        FROM
            quoteResponse
            INNER JOIN quote ON quoteResponse.quoteId = quote.quoteId
            INNER JOIN quoteResponseIlpPacket ON quoteResponseIlpPacket.quoteResponseId = quoteResponse.quoteResponseId
        WHERE
            quote.transactionReferenceId = ?`,
    quoteErrors: `SELECT 
            quoteError.quoteErrorId,
            quoteError.quoteId,
            quoteError.quoteResponseId,
            quoteError.errorCode,
            quoteError.errorDescription,
            quoteError.createdDate,
            quote.transactionReferenceId
        FROM
            quoteError
            INNER JOIN quoteResponse ON quoteError.quoteResponseId = quoteResponse.quoteResponseId
            INNER JOIN quote ON quoteError.quoteId = quote.quoteId
        WHERE
            quote.transactionReferenceId = ?`,
    transferPrepares: `SELECT
            transfer.transferId, 
            transfer.amount, 
            transfer.currencyId, 
            transfer.ilpCondition, 
            transfer.expirationDate, 
            transfer.createdDate
        FROM
            transfer
        WHERE
            transfer.transferId = ?`,
    transferFulfilments: `SELECT
            transferFulfilment.transferId, 
            transferFulfilment.ilpFulfilment, 
            transferFulfilment.completedDate, 
            transferFulfilment.isValid, 
            transferFulfilment.settlementWindowId, 
            transferFulfilment.createdDate
        FROM
            transferFulfilment
        WHERE
            transferFulfilment.transferId = ?`,
    transferParticipants: `SELECT 
            transferParticipant.transferParticipantId,
            transferParticipant.transferId,
            transferParticipant.participantCurrencyId,
            transferParticipantRoleType.name as transferParticipantRoleType,
            ledgerEntryType.name as ledgerEntryType,
            transferParticipant.amount,
            transferParticipant.createdDate
        FROM
            transferParticipant
            INNER JOIN transferParticipantRoleType ON transferParticipant.transferParticipantRoleTypeId = transferParticipantRoleType.transferParticipantRoleTypeId
            INNER JOIN ledgerEntryType ON transferParticipant.ledgerEntryTypeId = ledgerEntryType.ledgerEntryTypeId
        WHERE
            transferParticipant.transferId = ?`,
    transferStateChanges: `SELECT
            transferStateChange.transferStateChangeId, 
            transferStateChange.transferId, 
            transferState.enumeration,
            transferState.description,
            transferStateChange.reason, 
            transferStateChange.createdDate
        FROM
            transferStateChange
            INNER JOIN transferState ON transferStateChange.transferStateId = transferState.transferStateId
        WHERE
            transferStateChange.transferId = ?
        ORDER BY transferStateChange.transferStateChangeId`
};

module.exports = class Database {
    constructor(config) {
        this.connection = mysql.createPool({
            ...config,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        }).promise();

        this.MYSQL_MAX_DATETIME = MYSQL_MAX_DATETIME;
        this.MYSQL_MIN_DATETIME = MYSQL_MIN_DATETIME;
    }

    async getTransferAllDetails(transferId) {
        const [[quoteRequests],
            [quoteParties],
            [quoteResponses],
            [quoteErrors],
            [transferPrepares],
            [transferFulfilments],
            [transferParticipants],
            [transferStateChanges]] = await Promise.all([
            this.connection.query(transferAllDetailsQueries.quoteRequests, [transferId]),
            this.connection.query(transferAllDetailsQueries.quoteParties, [transferId]),
            this.connection.query(transferAllDetailsQueries.quoteResponses, [transferId]),
            this.connection.query(transferAllDetailsQueries.quoteErrors, [transferId]),
            this.connection.query(transferAllDetailsQueries.transferPrepares, [transferId]),
            this.connection.query(transferAllDetailsQueries.transferFulfilments, [transferId]),
            this.connection.query(transferAllDetailsQueries.transferParticipants, [transferId]),
            this.connection.query(transferAllDetailsQueries.transferStateChanges, [transferId]),
        ]);

        return {
            transferId,
            quoteRequests,
            quoteParties,
            quoteResponses,
            quoteErrors,
            transferPrepares,
            transferFulfilments,
            transferParticipants,
            transferStateChanges,
        };
    }

    async getTransfers(filter) {
        const params = [
            `%${filter.transferId ? filter.transferId : ''}%`,
            `%${filter.payerFspid ? filter.payerFspid : ''}%`,
            `%${filter.payeeFspid ? filter.payeeFspid : ''}%`,
            `%${filter.payerIdType ? filter.payerIdType : ''}%`,
            `%${filter.payeeIdType ? filter.payeeIdType : ''}%`,
            `%${filter.payerIdValue ? filter.payerIdValue : ''}%`,
            `%${filter.payeeIdValue ? filter.payeeIdValue : ''}%`,
            filter.from ? new Date(filter.from) : new Date(0),
            filter.to ? new Date(filter.to) : new Date(),
        ];

        const [result] = await this.connection.query(findTransfersQuery, params);
        return result;
    }


    // TODO: in this query we get multiple results returned per (dfsp,currency). We should only
    // really get a single result per (dfsp,currency). This is happening because all historical
    // limits are stored in the participantLimit table. We need to modify our query to return only
    // the latest. You can see some attempts at this in the 'positionQuery'. For now we filter the
    // results here, even though we shouldn't, really.
    async getPositionInfo(participantId) {
        const [fullResult] = await this.connection.query(positionQuery, [participantId]);
        const result = fullResult.reduce((pv, cv) => ({
            ...pv,
            // Take advantage of lexicographical string comparison operators
            [cv.currency]: (pv[cv.currency]
              && pv[cv.currency].limitCreatedDate > cv.limitCreatedDate) ? pv[cv.currency] : cv,
        }), {});
        return Object.values(result);
    }

    async getCurrentSettlementWindowId() {
        const thisSettlementWindowId = await this.connection.query(currentSettlementWindowId);
        return thisSettlementWindowId[0][0].settlementWindowId;
    }

    async getCurrentSettlementWindowInfo(participantId) {
        const [[payments], [receipts]] = await Promise.all([
            this.connection.query(currentSettlementWindowQueryPayments, [participantId]),
            this.connection.query(currentSettlementWindowQueryReceipts, [participantId]),
        ]);
        // return { payments: payments[0], receipts: receipts[0] };
        return { payments, receipts };
    }

    // TODO This method needs to be updated once the queries for previous settlement window id are
    // available
    async getPreviousSettlementWindowInfo(participantId) {
        // const [[payments,], [receipts,]] = await Promise.all([
        //   this.connection.query(previousSettlementWindowQueryPayments, [participantId]),
        //   this.connection.query(previousSettlementWindowQueryReceipts, [participantId])
        // ]);
        const [[payments], [receipts]] = await Promise.all([
            this.connection.query(currentSettlementWindowQueryPayments, [participantId]),
            this.connection.query(currentSettlementWindowQueryReceipts, [participantId]),
        ]);
        return { payments: payments[0], receipts: receipts[0] };
    }

    async getDfsps() {
        const [dfsps] = await this.connection.query(
            'SELECT p.participantId AS id, p.name FROM participant p',
        );
        return dfsps;
    }

    async getPaymentFileList(
        { fromDateTime = MYSQL_MIN_DATETIME, toDateTime = MYSQL_MAX_DATETIME } = {},
    ) {
        const [paymentFiles] = await this.connection.query(
            `SELECT settlementFileId, settlementId, createdDate, sentDate
             FROM settlementFile
             WHERE createdDate >= ? AND createdDate < ?`,
            [fromDateTime, toDateTime],
        );
        return paymentFiles;
    }

    async getPaymentFileById(id) {
        const [paymentFiles] = await this.connection.query(
            'SELECT settlementFile FROM settlementFile WHERE settlementFileId = ?', [id],
        );
        return paymentFiles.length === 0 ? '' : paymentFiles[0].settlementFile;
    }

    async getPaymentFileBySettlementWindowId(settlementWindowId) {
        const [paymentFiles] = await this.connection.query(
            `SELECT sf.settlementFile FROM settlementFile sf
         INNER JOIN settlement s ON s.settlementId = sf.settlementId
         INNER JOIN settlementSettlementWindow ssw ON ssw.settlementId = s.settlementId
         INNER JOIN settlementWindow sw ON sw.settlementWindowId = ssw.settlementWindowId
              WHERE sw.settlementWindowId = ?
           ORDER BY sf.createdDate DESC`, [settlementWindowId],
        );
        return paymentFiles.length === 0 ? '' : paymentFiles[0].settlementFile;
    }

    // This method starts a database transaction and locks the row, so it has to be matched by the
    // method 'updatePaymentMatrixState' defined below to make sure we commit the transaction and
    // release the lock.
    //
    // Further note: this and the matching updatePaymentMatrixState method should be used with an
    // exclusive connection. This is because the connection is the owner of the row lock in use
    // below. Therefore, if an exclusive connection is not used, it's possible with the mysql2
    // library for a subsequent request to reuse the connection and modify the locked row.
    // See: https://modusbox.atlassian.net/browse/MOWDEV-2433
    static async getPaymentMatrixForUpdate(conn, settlementId) {
        // start a transaction to lock the row to avoid any other update
        // const conn = await this.connection.getConnection();
        await conn.query('BEGIN');
        const [simplePaymentMatrix] = await conn.query(
            `SELECT sf.state FROM settlementFile sf
            WHERE sf.settlementId = ? FOR UPDATE`, [settlementId],
        );
        return (simplePaymentMatrix.length === 0
          || simplePaymentMatrix[0].state === null) ? null : simplePaymentMatrix[0].state;
    }

    // This method commits the database transaction started by the method
    // 'getPaymentMatrixForUpdate' defined above and releases the lock, so
    // 'getPaymentMatrixForUpdate' has to be executed before this method.
    //
    // Also, see the note about the connection on `getPaymentMatrixForUpdate`.
    static async updatePaymentMatrixState(conn, settlementId, state) {
        await conn.query(
            `UPDATE settlementFile sf SET sf.state = ?
            WHERE sf.settlementId = ? `, [state, settlementId],
        );
        // commit the transaction to release the lock
        return conn.query('COMMIT');
    }

    async dummyQuery() {
        await this.connection.query('SELECT 1 + 1 AS result');
    }

    async getHistoricalSettlementWindowData({ participantName, fromDateTime, toDateTime }) {
        const windows = await this.connection.query(historicalSettlementWindowDataQuery,
            [participantName, participantName, fromDateTime, toDateTime])
            .then((d) => d[0])
            .then((ws) => ws.map((w) => (
                { ...w, payments: Number(w.payments), receipts: Number(w.receipts) })));

        // Now we need to get the ndc and limit history for each currency present
        const currencies = [...(windows.reduce((currs, cv) => currs.add(cv.curr),
            new Set()).values())];
        const history = await this.getLimitAndPositionHistory({
            currencies,
            participantName,
            fromDateTime,
            toDateTime,
        });

        return { history, windows, currencies };
    }

    async getLimitAndPositionHistory({
        currencies, participantName, fromDateTime, toDateTime,
    }) {
        return Promise.all(currencies.map((curr) => Promise.all([
            curr,
            this.connection.query(
                historicalParticipantLimitQuery,
                [
                    fromDateTime,
                    toDateTime,
                    participantName,
                    curr,
                    fromDateTime,
                    participantName,
                    curr,
                    toDateTime,
                    participantName,
                    curr,
                ],
            ).then((l) => l[0]),
            this.connection.query(
                historicalParticipantPositionQuery,
                [
                    curr,
                    participantName,
                    fromDateTime,
                    toDateTime,
                    curr,
                    participantName,
                    fromDateTime,
                    curr,
                    participantName,
                    toDateTime,
                ],
            ).then((p) => p[0]),
        ]).then(([curr, limits, positions]) => [ // eslint-disable-line no-shadow
            // parse numeric values
            curr,
            limits.map((l) => ({ ...l, lim: Number(l.lim) })),
            positions.map((p) => ({ ...p, value: Number(p.value) })),
        ])));
    }

    async getPreviousSettlementWindowData({ participantName }) {
        const windows = await this
            .connection.query(previousSettlementWindowDataQuery, [participantName, participantName])
            .then((d) => d[0])
            .then((ws) => ws.map((w) => ({
                ...w,
                payments: Number(w.payments),
                receipts: Number(w.receipts),
            })));

        // Now we need to get the ndc and limit history for each currency present
        const currencies = [...(windows.reduce((currs, cv) => currs.add(cv.curr),
            new Set()).values())];

        const history = await this.getLimitAndPositionHistory({
            currencies,
            participantName,
            fromDateTime: windows[0].open,
            toDateTime: windows[0].close,
        });

        return { history, windows, currencies };
    }

    async getSettlementWindowInfo(settlementWindowId) {
        const [[settlementWindow], [outAmount],
            [inAmount], [netAmount], [settlement]] = await Promise.all([
            this.connection.query(settlementWindowInfoQuery,
                [settlementWindowId, settlementWindowId, settlementWindowId,
                    settlementWindowId, settlementWindowId]),
            this.connection.query(outAmountQuery, [settlementWindowId]),
            this.connection.query(inAmountQuery, [settlementWindowId]),
            this.connection.query(netAmountQuery, [settlementWindowId]),
            this.connection.query(settlementSettlementWindowQuery, [settlementWindowId]),
        ]);
        const settlementId = (settlement.length === 1 ? settlement[0].settlementId : 0);

        const [relatedSettlementWindows] = await this.connection.query(
            settlementWindowsInSettlementQuery, [settlementId, settlementWindowId],
        );

        const participantAmount = [];

        // TODO: use const participantAmount = netAmount.map(...) here?
        netAmount.forEach((element) => {
            const inRecord = inAmount.find((n) => n.fspId === element.fspId);
            const outRecord = outAmount.find((n) => n.fspId === element.fspId);
            const inValue = inRecord ? inRecord.inAmount : 0;
            const outValue = outRecord ? outRecord.outAmount : 0;
            const obj = {
                fspId: element.fspId,
                inAmount: inValue,
                currency: element.currency,
                outAmount: outValue,
                netAmount: element.netAmount,
            };
            participantAmount.push(obj);
        });
        const totalAmounts = sumAllParticipants(participantAmount);
        const sumTotalAmount = convertParticipantsAmountsToStrings(totalAmounts);
        const result = settlementWindow.filter((n) => n.settlementWindowId !== null);
        return {
            settlementWindow: (result.length === 1 ? result[0] : {}),
            participantAmount,
            totalAmount: sumTotalAmount,
            settlementId,
            relatedSettlementWindows,
        };
    }

    async getSettlementWindows({ fromDateTime, toDateTime }) {
        const [fullResult] = await this.connection.query(
            settlementWindowListQuery, [fromDateTime, toDateTime],
        );
        return fullResult;
    }

    async getSettlementAccountBalance(participantId) {
        const [fullResult] = await this.connection.query(
            settlementAccountBalanceQuery, [participantId],
        );
        return fullResult;
    }

    async getTransferState(transferId) {
        const [transferState] = await this.connection.query(`
            SELECT * FROM transferStateChange tsc
            WHERE tsc.transferId = ?
            ORDER BY tsc.transferStateChangeId DESC
            LIMIT 1`,
        [transferId]);
        return transferState[0] || null;
    }

    async getParticipantIsActiveFlag(participantId) {
        const [result] = await this.connection.query(
            'SELECT p.isActive FROM participant p where participantId = ?', [participantId],
        );
        return (result && result[0]) ? result[0].isActive : 0;
    }

    async getTransferDetails(transferId) {
        const [result] = await this.connection.query(transferDetailsQuery, [transferId]);
        return (result && result[0]) ? result[0] : null;
    }
};
