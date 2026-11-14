//! Error type shared by the preparation pipeline.

use std::fmt;

/// A failure with a message meant for the person running the tool.
#[derive(Debug, Clone, PartialEq)]
pub struct PrepError(pub String);

impl PrepError {
    pub fn new(message: impl Into<String>) -> Self {
        PrepError(message.into())
    }
}

impl fmt::Display for PrepError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for PrepError {}

pub type Result<T> = std::result::Result<T, PrepError>;
