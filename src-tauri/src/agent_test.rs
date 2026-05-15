use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentFrontmatter {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools_allowed: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills_allowed: Option<Vec<String>>,
}

fn main() {
    let md = r#"---
name: Test Agent
description: "A test agent"
model_class: fast
tools_allowed:
  - tool1
skills_allowed: []
---

body
"#;
    let parts: Vec<&str> = md.splitn(3, "---").collect();
    let frontmatter_str = parts[1];
    
    let frontmatter: AgentFrontmatter = serde_yaml::from_str(frontmatter_str).unwrap();
    println!("{:?}", frontmatter);
    
    let yaml = serde_yaml::to_string(&frontmatter).unwrap();
    println!("{}", yaml);
}
