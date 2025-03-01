import requests
import json

def test_root_endpoint():
    """Test the root endpoint of the API."""
    response = requests.get("http://localhost:8000/")
    print(f"Root endpoint response: {response.status_code}")
    print(response.json())
    print()

def test_parameters_endpoint():
    """Test the parameters endpoint."""
    response = requests.get("http://localhost:8000/parameters")
    print(f"Parameters endpoint response: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
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
    print()

def test_parameter_commands():
    """Test parameter modification commands."""
    url = "http://localhost:8000/command"
    headers = {"Content-Type": "application/json"}
    
    parameter_commands = [
        "Make the gravity weaker",
        "Speed up the darts",
        "Make the platforms wider",
        "Create a more challenging environment",
        "Reset all parameters to default",
        "Tilt the platforms to the right",
        "Make the gaps between platforms narrower",
        "Create a moon-like environment with low gravity and slow darts",
    ]
    
    for command in parameter_commands:
        data = {"command": command}
        
        response = requests.post(url, headers=headers, data=json.dumps(data))
        print(f"Command: '{command}'")
        print(f"Response status: {response.status_code}")
        
        result = response.json()
        print(f"AI response: {result['response']}")
        
        if result.get("parameter_modifications"):
            print("Parameter modifications:")
            for mod in result["parameter_modifications"]:
                param = mod["parameter"]
                value = mod["normalized_value"]
                print(f"  - {param}: {value}")
        else:
            print("No parameter modifications")
        
        print("-" * 50)

if __name__ == "__main__":
    print("Testing API endpoints...\n")
    
    try:
        test_root_endpoint()
        test_parameters_endpoint()
        test_command_endpoint()
        
        print("\nTesting parameter commands...\n")
        test_parameter_commands()
        
        print("All tests completed!")
    except Exception as e:
        print(f"Error during testing: {str(e)}")
        print("Make sure the API server is running on http://localhost:8000") 