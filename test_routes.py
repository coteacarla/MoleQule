"""Test script to list all registered Flask routes"""
from app import create_app

app = create_app()

print("\n" + "="*80)
print("REGISTERED ROUTES:")
print("="*80)

routes = []
for rule in app.url_map.iter_rules():
    routes.append({
        'endpoint': rule.endpoint,
        'methods': ','.join(sorted(rule.methods - {'HEAD', 'OPTIONS'})),
        'path': rule.rule
    })

# Sort by path
routes.sort(key=lambda x: x['path'])

for route in routes:
    print(f"{route['methods']:8} {route['path']:50} -> {route['endpoint']}")

print("="*80)
print(f"Total routes: {len(routes)}")
print("="*80 + "\n")

# Check specifically for active-space route
active_space_routes = [r for r in routes if 'active-space' in r['path']]
if active_space_routes:
    print("✓ Active Space routes found:")
    for route in active_space_routes:
        print(f"  {route['methods']:8} {route['path']}")
else:
    print("✗ No active-space routes found!")
