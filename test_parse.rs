use std::fs;

fn main() {
    let content = fs::read_to_string("test-vault/.glade/agents/email_checker_v1.agent.md").unwrap();
    println!("File loaded");
}
