import requests
import json

def test_root_endpoint():
    """Test the root endpoint of the API."""
    response = requests.get("http://localhost:8000/")
    print(f"Root endpoint response: {response.status_code}")
    print(response.json())
    print()

def test_command_endpoint():
    """Test the command endpoint with a sample command."""
    url = "http://localhost:8000/command"
    headers = {"Content-Type": "application/json"}
    
    # Test with a simple command
    data = {"command": "Hello, what can you do in this game?"}
    
    response = requests.post(url, headers=headers, data=json.dumps(data))
    print(f"Command endpoint response: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()
    
    # Test with another command
    data = {"command": "Tell me about the goat character"}
    
    response = requests.post(url, headers=headers, data=json.dumps(data))
    print(f"Command endpoint response: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    print("Testing API endpoints...\n")
    
    try:
        test_root_endpoint()
        test_command_endpoint()
        print("All tests completed!")
    except Exception as e:
        print(f"Error during testing: {str(e)}")
        print("Make sure the API server is running on http://localhost:8000") 