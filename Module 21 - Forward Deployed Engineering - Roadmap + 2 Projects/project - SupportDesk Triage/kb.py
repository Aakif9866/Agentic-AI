"""Brewly's help centre: 10 articles, and a keyword retriever over them.

ponytail: keyword overlap, not embeddings. With 10 articles a vector DB adds a
~1GB torch install and buys nothing measurable (see CASE_STUDY.md §2). Swap
`retrieve` for a vector store when the help centre passes ~100 articles.
"""
import re

ARTICLES = {
    "KB-01": ("billing", "Updating your payment card",
              "Go to Settings > Billing > Payment method and choose Replace card. The new card is used "
              "from your next renewal. Failed payments are retried automatically after 3 days."),
    "KB-02": ("billing", "Why was I charged twice?",
              "A second charge is usually a pending authorization from a failed payment attempt. Pending "
              "authorizations disappear from your bank statement within 5 business days. Check "
              "Settings > Billing > Invoices: only charges listed there are real."),
    "KB-03": ("account", "Resetting your password",
              "On the login screen tap Forgot password and enter your account email. The reset link "
              "expires after 30 minutes. Check your spam folder if the email does not arrive."),
    "KB-04": ("account", "Lost phone and two-factor authentication",
              "Use one of the backup codes you saved when you enabled two-factor authentication. Each "
              "code works once. After logging in, go to Settings > Security to set up 2FA on your new phone."),
    "KB-05": ("account", "Changing your email address",
              "Go to Settings > Profile > Email, enter the new address and confirm the verification "
              "link we send to it. Your login email changes once the link is confirmed."),
    "KB-06": ("bug", "The app will not load or shows a blank screen",
              "Update the app to the latest version, then clear the app cache (Settings > Storage > "
              "Clear cache) and restart your phone. On the web, try a private window to rule out extensions."),
    "KB-07": ("bug", "Orders or favourites not syncing between devices",
              "Sync needs you to be logged in with the same account on every device. Pull down on the "
              "Orders screen to force a sync. Sync can take up to 2 minutes on mobile data."),
    "KB-08": ("shipping", "Tracking your delivery",
              "Your tracking link is in the dispatch email and under Orders > Track. Tracking can take "
              "24 hours to show movement after dispatch. Deliveries take 2 to 4 business days."),
    "KB-09": ("shipping", "Changing your delivery address",
              "You can change the address under Orders > Edit until the order is dispatched. After "
              "dispatch the address cannot be changed; contact the courier using the tracking link."),
    "KB-10": ("feature_request", "How we handle feature requests",
              "Thank you for the idea. Every request is logged and reviewed by the product team each "
              "month. Popular requests appear on the public roadmap at brewly.example/roadmap."),
}

STOP = set("a an the i my me to of and or is it in on for at be was have has can not do does with "
           "this that you your we our from but how why what when are am so just get got please hi "
           "hello thanks thank there any".split())


def _tokens(text: str) -> set[str]:
    # crude stem: "charged"/"charges" -> "charg". Good enough for 10 articles.
    return {re.sub(r"(ing|ed|es|s)$", "", w) for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP}


def retrieve(ticket: str, category: str, min_overlap: int = 2) -> str | None:
    """Best article id within the ticket's category, or None if nothing overlaps enough."""
    if category == "feature_request":
        return "KB-10"  # one generic article by design; keyword overlap never matches it (eval round 1)
    words = _tokens(ticket)
    scored = [(len(words & _tokens(title + " " + body)), aid)
              for aid, (cat, title, body) in ARTICLES.items() if cat == category]
    best = max(scored, default=(0, None))
    return best[1] if best[0] >= min_overlap else None
