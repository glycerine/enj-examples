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
	game = enj.NewGame(800, 600, false, "example", &Hello{50, 80, 110})
}
