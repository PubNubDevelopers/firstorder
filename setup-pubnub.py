#!/usr/bin/env python3
import requests
import json
import sys

API_KEY = "si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"
BASE_URL = "https://ps.pndsn.com/v2"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def create_app(name):
    """Create a new PubNub app"""
    print(f"Creating PubNub App: {name}")

    response = requests.post(
        f"{BASE_URL}/apps",
        headers=headers,
        json={"name": name}
    )

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code in [200, 201]:
        app_data = response.json()
        print(f"✓ App created successfully!")
        print(f"App ID: {app_data.get('id')}")
        return app_data.get('id')
    else:
        print(f"✗ Failed to create app")
        print(f"Error: {response.text}")
        return None

def create_keyset(app_id, name):
    """Create a keyset with full configuration"""
    print(f"\nCreating keyset: {name}")

    keyset_config = {
        "app_id": app_id,
        "name": name,
        "production": False,
        "features": {
            "message_persistence": {
                "enabled": True,
                "retention": 7,
                "delete_from_history": True,
                "include_presence_events": False
            },
            "presence": {
                "enabled": True,
                "announce_max": 20,
                "interval": 10,
                "deltas": True,
                "debounce": 3,
                "generate_leave_on_disconnect": True,
                "stream_filtering": False
            },
            "objects": {
                "enabled": True,
                "region": "aws-iad-1",
                "user_metadata_events": True,
                "channel_metadata_events": True,
                "membership_events": True,
                "referential_integrity": False,
                "disallow_get_all_user_metadata": False,
                "disallow_get_all_channel_metadata": False
            }
        }
    }

    response = requests.post(
        f"{BASE_URL}/keys",
        headers=headers,
        json=keyset_config
    )

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code in [200, 201]:
        keyset_data = response.json()
        print(f"✓ Keyset created successfully!")
        print(f"\nPublish Key: {keyset_data.get('publish_key')}")
        print(f"Subscribe Key: {keyset_data.get('subscribe_key')}")
        return keyset_data
    else:
        print(f"✗ Failed to create keyset")
        print(f"Error: {response.text}")
        return None

def save_env_file(pub_key, sub_key):
    """Save keys to .env file"""
    env_content = f"""VITE_PUBNUB_PUBLISH_KEY={pub_key}
VITE_PUBNUB_SUBSCRIBE_KEY={sub_key}
"""

    with open('/Users/craig/Documents/gits/swapit/client/.env', 'w') as f:
        f.write(env_content)

    print(f"\n✓ .env file created at client/.env")
    print(f"\nYour PubNub keys are ready to use!")
    print(f"\nNext steps:")
    print(f"1. Deploy the Before Publish Function from server/before-publish-function.js")
    print(f"2. Configure it to run on channel pattern: game.*")
    print(f"3. Enable KV Store for the Function")
    print(f"4. Test the game!")

def main():
    # Create app
    app_id = create_app("Swap It Game")

    if not app_id:
        sys.exit(1)

    # Create keyset
    keyset_data = create_keyset(app_id, "Swap It Game Keys")

    if not keyset_data:
        sys.exit(1)

    # Save to .env
    save_env_file(
        keyset_data.get('publish_key'),
        keyset_data.get('subscribe_key')
    )

if __name__ == "__main__":
    main()
