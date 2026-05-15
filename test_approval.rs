fn main() {
    let explicitly_allowed = true;
    let require_approval_override = false;
    let mut requires_approval = true;
    
    if requires_approval {
        if explicitly_allowed && !require_approval_override {
            requires_approval = false;
        }
    }
    println!("requires_approval = {}", requires_approval);
}
