package main

import (
	"github.com/ajhager/enj"
	"math/rand"
)

var game *enj.Game

type Hello struct {
	*enj.App
	Time float32
}

func (h *Hello) Update(dt float32) {
	h.Time += dt
	if h.Time > 0.5 {
		h.Time = 0
		game.SetBgColor(byte(rand.Intn(256)), byte(rand.Intn(256)), byte(rand.Intn(256)), 255)
	}
}

func main() {
	game = enj.NewGame(800, 600, false, "example", new(Hello))
}
