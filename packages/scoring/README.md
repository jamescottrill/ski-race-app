# @awsa/scoring

Pure JavaScript rules shared by the Ski Race Results desktop app and the public
results site: race points and discipline factors, result row mapping and
partitioning, category podiums, team scoring, Championship Penalty Points (CPP)
and competitor classification codes.

Nothing in here touches React, the DOM or a database, so every rule is unit
tested directly. Run the tests with `npm -w packages/scoring test`.

The discipline factors in `src/factors.js` must stay equal to the `race_factors`
table on the server; a test on each side guards that.
