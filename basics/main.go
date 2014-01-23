package main

import (
	"github.com/ajhager/enj"
	"github.com/ajhager/webgl"
	"math"
)

var (
	game    *enj.Game
	time    float32
	regions []*enj.Region
	batch   *enj.Batch
	mx, my  float32
	down    float32
)

type Basics int

func (b *Basics) Load() {
	game.Load.Image("bot.png")
}

func (b *Basics) Setup() {
	texture := game.NewTexture("bot.png", false)
	texture.SetFilter(webgl.NEAREST, webgl.NEAREST)
	regions = texture.Split(32, 32)
	batch = game.NewBatch()
	down = 50
	game.SetBgColor(30, 60, 90, 255)
}

func (b *Basics) Update(dt float32) {
	time += dt * 200
}

func (b *Basics) Draw() {
	batch.Begin()
	batch.Draw(regions[0], mx-16, my-16, 16, 16, 2, 2, 0)
	batch.Draw(regions[4+int(math.Mod(float64(time), 6))], mx-16-down, my-16, down+16, 16, down/50, down/50, float32(time/2+90))
	batch.End()
}

func (b *Basics) Mouse(x, y float32, e int) {
	switch e {
	case enj.MOUSEMOVE:
		mx = x
		my = y
	case enj.MOUSEDOWN:
		down = 100
	case enj.MOUSEUP:
		down = 50
	}
}

func (b *Basics) Key(key int, e int) {
	println(key)
}

func main() {
	game = enj.NewGame(960, 640, false, "example", new(Basics))
}
