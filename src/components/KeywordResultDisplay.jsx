const React = require('react');
const PropTypes = require('prop-types');

function keywordErrorDisplay(x) {
    if (x.keyword && x.errorMessage) {
        return `${x.keyword.keyword}: ${x.errorMessage}`;
    }
    if (typeof x == 'string')
        return x;
    return JSON.stringify(x); // not great, but at least it's something
}

function KeywordResultDisplay(props) {
    const { ok, fail } = props;
    const successDisplay = ok.length 
        ? <span><span style={{ color: 'green', fontWeight: 'bold' }}>✓</span>&nbsp;Copied {ok.length} keywords</span>
        : null;

    const errorDisplay = fail.length
        ? <div style={{height: '180px', overflow: 'auto'}}>We encountered some errors while attempting to copy these keywords:
            {fail.map((x, idx) => <p key={idx} className="machete-error">{keywordErrorDisplay(x)}</p>)}
          </div>
        : null;

    return <div>{successDisplay}{errorDisplay}</div>;
}

KeywordResultDisplay.propTypes = {
    ok: PropTypes.array.isRequired,
    fail: PropTypes.array.isRequired,
};

module.exports = KeywordResultDisplay;
