#!/usr/bin/env python3
"""
PubNub Resource Creation Script
Creates app and keyset for Swap It! game using PubNub Portal API v2
"""

import json
import sys
import requests

API_KEY = "si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"
BASE_URL = "https://ps.pndsn.com/v2"

def create_app(name):
    """Create a PubNub app"""
    print(f"Creating app: {name}...")

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    data = {"name": name}

    response = requests.post(
        f"{BASE_URL}/apps",
        headers=headers,
        json=data
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code in [200, 201]:
        app_data = response.json()
        print(f"✅ App created successfully!")
        print(f"   App ID: {app_data.get('id')}")
        return app_data.get('id')
    else:
        print(f"❌ Failed to create app")
        print(f"   Error: {response.text}")
        return None

def create_keyset(app_id, name):
    """Create a keyset with required configuration"""
    print(f"\nCreating keyset: {name}...")

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    config = {
        "name": name,
        "type": "production",
        "config": {
            "messagePersistence": {
                "enabled": True,
                "retention": 7,
                "deleteFromHistory": True,
                "includePresenceEvents": False
            },
            "appContext": {
                "enabled": True,
                "region": "aws-iad-1",
                "userMetadataEvents": False,
                "channelMetadataEvents": False,
                "membershipEvents": False,
                "disallowGetAllUserMetadata": False,
                "disallowGetAllChannelMetadata": False,
                "referentialIntegrity": False
            },
            "presence": {
                "enabled": False
            },
            "files": {
                "enabled": False
            }
        }
    }

    response = requests.post(
        f"{BASE_URL}/apps/{app_id}/keysets",
        headers=headers,
        json=config
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}...")

    if response.status_code in [200, 201]:
        keyset_data = response.json()
        print(f"✅ Keyset created successfully!")
        print(f"   Keyset ID: {keyset_data.get('id')}")
        print(f"   Publish Key: {keyset_data.get('publishKey')}")
        print(f"   Subscribe Key: {keyset_data.get('subscribeKey')}")
        return keyset_data
    else:
        print(f"❌ Failed to create keyset")
        print(f"   Error: {response.text}")
        return None

def create_env_file(publish_key, subscribe_key):
    """Create .env file with keys"""
    print(f"\nCreating .env file...")

    env_content = f"""# PubNub Configuration for Swap It!
# Generated automatically

VITE_PUBNUB_PUBLISH_KEY={publish_key}
VITE_PUBNUB_SUBSCRIBE_KEY={subscribe_key}
"""

    with open('.env', 'w') as f:
        f.write(env_content)

    print(f"✅ .env file created!")

def main():
    print("=" * 50)
    print("PubNub Resource Creation for Swap It!")
    print("=" * 50)
    print()

    # Create app
    app_id = create_app("Swap It Game")
    if not app_id:
        print("\n❌ Setup failed at app creation")
        sys.exit(1)

    # Create keyset
    keyset_data = create_keyset(app_id, "Swap It Production")
    if not keyset_data:
        print("\n❌ Setup failed at keyset creation")
        sys.exit(1)

    # Create .env file
    publish_key = keyset_data.get('publishKey')
    subscribe_key = keyset_data.get('subscribeKey')

    if publish_key and subscribe_key:
        create_env_file(publish_key, subscribe_key)
    else:
        print("\n❌ Could not extract keys from response")
        sys.exit(1)

    print()
    print("=" * 50)
    print("Setup Complete!")
    print("=" * 50)
    print()
    print(f"App ID: {app_id}")
    print(f"Publish Key: {publish_key}")
    print(f"Subscribe Key: {subscribe_key}")
    print()
    print("Next steps:")
    print("1. Go to https://dashboard.pubnub.com")
    print("2. Navigate to Functions in your keyset")
    print("3. Deploy the function from server/before-publish-function.js")
    print("4. Initialize test game in KV Store")
    print("5. Run: npm run dev")
    print()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
