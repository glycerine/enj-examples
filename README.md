# Enj Examples

You can checkout the examples in this project to get a feel for how to use the [enj](https://github.com/ajhager/enj) game library, but to start your own project from scratch, you will need to setup a few things first.

## Manual Setup

Start my creating a folder somewhere in your GOPATH. For this example, let's name the folder 'hello'.

Inside the 'hello' folder you will first need to create an index.html file in order to test your game. From the example below you can see that you need a div with a unique id and a link to the generated javascript file.

```html
<!DOCTYPE HTML>
<html>
  <head>
    <title>Hello Enj</title>
    <style>body { margin: 0; padding: 0; background-color: #222222; }</style>
  </head>
  <body>
    <div id="hello"></div>
    <script type="text/javascript" src="hello.js"></script>
  </body>
</html>
```

Next let's create a main.go file in the 'hello' folder. For now, your app needs to satisfy the enj.Responder interface which has methods for loading resources, setting up state, updating state, drawing, and handling mouse and keyboard actions.

```go
package main

import ( 
  "github.com/ajhager/enj"
  "math/rand"
)

var game *enj.Game

type Hello struct {
  Red, Green, Blue byte
}

func (h *Hello) Load() {
}

func (h *Hello) Setup() {
}

func (h *Hello) Update(dt float32) {
}

func (h *Hello) Draw() {
  game.SetBgColor(h.Red, h.Green, h.Blue, 255)
}

func (h *Hello) Mouse(x, y float32, action int) {
  switch action {
  case enj.MOUSEMOVE:
  case enj.MOUSEDOWN:
    h.Red = byte(rand.Intn(256))
    h.Green = byte(rand.Intn(256))	  
    h.Blue = byte(rand.Intn(256))
  case enj.MOUSEUP:
  }
}

func (h *Hello) Key(key int, action int) {
}

func main() {
  game = enj.NewGame(960, 640, false, "hello", &Hello{30, 60, 90})
}
```

You can build your project by typing the command:

    $ gopherjs build
    
You should now be able to open your index.html file in a browser of your choice and check out your game! Keep in mind that as soon as you want to start loading assets, you will need to serve your app with a real web browser. I recommend using [http-server](https://github.com/nodeapps/http-server) for now.
