use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config, Matcher, Utf32Str};

/// Fuzzy-matches a query against a haystack string using nucleo.
/// Returns `true` if the query matches (or is empty).
#[cfg(test)]
pub fn fuzzy_matches(query: &str, haystack: &str) -> bool {
    if query.is_empty() {
        return true;
    }

    let mut matcher = Matcher::new(Config::DEFAULT);
    let atom = Atom::new(
        query,
        CaseMatching::Ignore,
        Normalization::Smart,
        AtomKind::Fuzzy,
        false,
    );

    let mut buf = Vec::new();
    let haystack_utf32 = Utf32Str::new(haystack, &mut buf);
    atom.score(haystack_utf32, &mut matcher).is_some()
}

/// Filters a list of items by fuzzy matching the query against a text
/// extracted from each item. Returns indices of matching items.
pub fn fuzzy_filter<T>(
    items: &[T],
    query: &str,
    text_fn: impl Fn(&T) -> String,
) -> Vec<usize> {
    if query.is_empty() {
        return (0..items.len()).collect();
    }

    let mut matcher = Matcher::new(Config::DEFAULT);
    let atom = Atom::new(
        query,
        CaseMatching::Ignore,
        Normalization::Smart,
        AtomKind::Fuzzy,
        false,
    );

    items
        .iter()
        .enumerate()
        .filter(|(_, item)| {
            let text = text_fn(item);
            let mut buf = Vec::new();
            let haystack = Utf32Str::new(&text, &mut buf);
            atom.score(haystack, &mut matcher).is_some()
        })
        .map(|(i, _)| i)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_query_matches_everything() {
        assert!(fuzzy_matches("", "anything"));
        assert!(fuzzy_matches("", ""));
    }

    #[test]
    fn exact_match() {
        assert!(fuzzy_matches("hello", "hello world"));
    }

    #[test]
    fn fuzzy_match() {
        assert!(fuzzy_matches("hlo", "hello"));
        assert!(fuzzy_matches("fxbg", "Fix login bug"));
    }

    #[test]
    fn no_match() {
        assert!(!fuzzy_matches("xyz", "hello"));
    }

    #[test]
    fn case_insensitive() {
        assert!(fuzzy_matches("HELLO", "hello world"));
        assert!(fuzzy_matches("hello", "HELLO WORLD"));
    }

    #[test]
    fn filter_items() {
        let items = vec!["Fix login bug", "Write tests", "Design API", "Fix logout"];
        let matches = fuzzy_filter(&items, "fix", |s| s.to_string());
        assert_eq!(matches, vec![0, 3]); // "Fix login bug" and "Fix logout"
    }

    #[test]
    fn filter_empty_query_returns_all() {
        let items = vec!["a", "b", "c"];
        let matches = fuzzy_filter(&items, "", |s| s.to_string());
        assert_eq!(matches, vec![0, 1, 2]);
    }

    #[test]
    fn filter_no_matches() {
        let items = vec!["hello", "world"];
        let matches = fuzzy_filter(&items, "zzz", |s| s.to_string());
        assert!(matches.is_empty());
    }
}
