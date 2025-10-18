import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemsCrudComponent } from './items-crud.component';

describe('ItemsCrudComponent', () => {
  let component: ItemsCrudComponent;
  let fixture: ComponentFixture<ItemsCrudComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemsCrudComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemsCrudComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
