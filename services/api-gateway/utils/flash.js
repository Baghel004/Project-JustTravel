// Cookie-based flash messages — a drop-in replacement for connect-flash that needs
// no server-side session store. Messages are carried to the *next* request in a
// short-lived httpOnly cookie, then cleared on read. This keeps the app stateless,
// which is required once it is split across services behind the gateway.
//
// Exposes the same surface the app already used:
//   req.flash("success"|"error", msg)   -> queue a message for the next response
//   res.locals.success / res.locals.error -> arrays available in views this request

module.exports = function cookieFlash(req, res, next) {
    let incoming = { success: [], error: [] };
    try {
        const parsed = JSON.parse(req.cookies._flash || '{}');
        incoming.success = parsed.success || [];
        incoming.error = parsed.error || [];
    } catch (e) {
        // malformed cookie -> ignore, treat as empty
    }
    res.locals.success = incoming.success;
    res.locals.error = incoming.error;
    res.clearCookie('_flash');

    const pending = { success: [], error: [] };
    req.flash = (type, msg) => {
        if (!pending[type]) pending[type] = [];
        pending[type].push(msg);
        res.cookie('_flash', JSON.stringify(pending), { httpOnly: true, maxAge: 5 * 60 * 1000 });
    };

    next();
};
